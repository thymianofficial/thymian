import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Report } from '@thymian/core';
import {
  createLintExecution,
  createReport,
  createToolRun,
  NoopLogger,
  Thymian,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { JsonFormatter } from '../src/formatters/json.js';
import { reporterPlugin } from '../src/index.js';

function sampleReport(options?: {
  toolName?: string;
  thymianFormat?: Report['thymianFormat'];
  runCount?: number;
}): Report {
  const runCount = options?.runCount ?? 1;
  const runs = Array.from({ length: runCount }, (_, index) =>
    createToolRun({
      tool: { name: options?.toolName ?? `sample-tool-${index.toString()}` },
      runType: 'lint',
      executions: [
        createLintExecution({
          location: { type: 'custom', value: `check-${index.toString()}` },
          ruleId: 'example/rule',
          status: { kind: 'failed', reason: 'persisted finding' },
        }),
      ],
      thymianFormatVersion: options?.thymianFormat
        ? Object.keys(options.thymianFormat)[0]
        : undefined,
    }),
  );

  return createReport(runs, options?.thymianFormat);
}

describe('thymian-report-input', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'thymian-report-input-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeReportFile(
    name: string,
    content: unknown,
  ): Promise<string> {
    const filePath = join(tmpDir, name);
    await writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content),
      'utf-8',
    );
    return filePath;
  }

  it('claims only thymian inputs; other types stay unclaimed', async () => {
    const reportFile = await writeReportFile('report.json', sampleReport());
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [
        { type: 'thymian', location: reportFile },
        { type: 'not-thymian', location: './other.json' },
      ],
    });

    expect(outcome.report.runs).toHaveLength(1);
    expect(outcome.unclaimed).toEqual([
      { type: 'not-thymian', location: './other.json' },
    ]);

    await thymian.close();
  });

  it('replies an empty fragment list without stalling when nothing is claimed', async () => {
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'not-thymian', location: './other.json' }],
    });

    expect(outcome.report.runs).toEqual([]);
    expect(outcome.unclaimed).toHaveLength(1);

    await thymian.close();
  });

  it('passes runs through as-is from a bare Report object (identity preserved)', async () => {
    const source = sampleReport({ toolName: 'source-tool' });
    const reportFile = await writeReportFile('bare.json', source);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'thymian', location: reportFile }],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs).toHaveLength(1);
    // The persisted run keeps its identity — no re-minting.
    expect(outcome.report.runs[0]?.runId).toBe(source.runs[0]?.runId);
    expect(outcome.report.runs[0]?.runAt).toBe(source.runs[0]?.runAt);
    expect(outcome.report.runs[0]?.tool.name).toBe('source-tool');

    await thymian.close();
  });

  it('carries every run of every report in a Report[] array input, in order', async () => {
    const first = sampleReport({ toolName: 'array-tool-a', runCount: 2 });
    const second = sampleReport({ toolName: 'array-tool-b', runCount: 2 });
    const reportFile = await writeReportFile('array.json', [first, second]);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'thymian', location: reportFile }],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs.map((run) => run.runId)).toEqual([
      ...first.runs.map((run) => run.runId),
      ...second.runs.map((run) => run.runId),
    ]);

    await thymian.close();
  });

  it('passes the source report thymianFormat map into the merged report', async () => {
    const serialized = {
      attributes: { hash: 'persisted-hash' },
      nodes: [],
      edges: [],
    } as unknown as NonNullable<Report['thymianFormat']>[string];
    const source = sampleReport({
      thymianFormat: { 'persisted-hash': serialized },
    });
    const reportFile = await writeReportFile('with-format.json', source);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'thymian', location: reportFile }],
    });

    expect(outcome.report.thymianFormat).toBeDefined();
    expect(Object.keys(outcome.report.thymianFormat ?? {})).toContain(
      'persisted-hash',
    );
    expect(outcome.report.runs[0]?.thymianFormatVersion).toBe('persisted-hash');

    await thymian.close();
  });

  it('tolerates a UTF-8 BOM at the start of the report file', async () => {
    const reportFile = await writeReportFile(
      'bom.json',
      `\uFEFF${JSON.stringify(sampleReport())}`,
    );
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'thymian', location: reportFile }],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs).toHaveLength(1);

    await thymian.close();
  });

  it('throws a ThymianBaseError naming the input for a missing file', async () => {
    const missing = join(tmpDir, 'does-not-exist.json');
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportConvert({
        reports: [{ type: 'thymian', location: missing }],
      }),
    ).rejects.toThrow(`thymian:${missing}`);

    await thymian.close();
  });

  it('throws a ThymianBaseError naming the input for a non-JSON file', async () => {
    const reportFile = await writeReportFile('broken.json', '{not json');
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportConvert({
        reports: [{ type: 'thymian', location: reportFile }],
      }),
    ).rejects.toThrow(`thymian:${reportFile}`);

    await thymian.close();
  });

  it('throws a ThymianBaseError naming the input when the JSON is not a Thymian report', async () => {
    const reportFile = await writeReportFile('invalid.json', {
      reportId: 'r-1',
      // createdAt and runs missing — fails reportSchema.
    });
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportConvert({
        reports: [{ type: 'thymian', location: reportFile }],
      }),
    ).rejects.toThrow(`thymian:${reportFile}`);

    await thymian.close();
  });

  it('throws a ThymianBaseError naming the input for an empty report array', async () => {
    const reportFile = await writeReportFile('empty.json', []);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportConvert({
        reports: [{ type: 'thymian', location: reportFile }],
      }),
    ).rejects.toThrow(`thymian:${reportFile}`);

    await thymian.close();
  });

  it('throws a ThymianBaseError naming the input when no report contains any run', async () => {
    const reportFile = await writeReportFile('no-runs.json', createReport([]));
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportConvert({
        reports: [{ type: 'thymian', location: reportFile }],
      }),
    ).rejects.toThrow(`thymian:${reportFile}`);

    await thymian.close();
  });

  it('round-trips a report written by this package: JSON formatter out, thymian: claim back in', async () => {
    const source = sampleReport({ toolName: 'round-trip-tool', runCount: 2 });
    const reportPath = join(tmpDir, 'round-trip.json');

    // Write side: persist through the real JSON formatter — the exact
    // payload the loader is contracted to read back.
    const formatter = new JsonFormatter(new NoopLogger());
    formatter.init({ path: reportPath });
    formatter.report(source);
    await formatter.flush();

    // Read side: claim the persisted file via core.report.convert.
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'thymian', location: reportPath }],
    });

    expect(outcome.unclaimed).toEqual([]);
    // Runs survive the full write/read cycle identity-preserved.
    expect(outcome.report.runs.map((run) => run.runId)).toEqual(
      source.runs.map((run) => run.runId),
    );
    expect(outcome.report.runs[0]?.runAt).toBe(source.runs[0]?.runAt);
    expect(outcome.report.runs[0]?.tool.name).toBe('round-trip-tool');

    await thymian.close();
  });

  it('resolves a relative location against the plugin cwd option', async () => {
    await writeReportFile('relative.json', sampleReport());
    const thymian = new Thymian(undefined, { cwd: tmpDir }).register(
      reporterPlugin,
      { formatters: {} },
    );
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'thymian', location: 'relative.json' }],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs).toHaveLength(1);

    await thymian.close();
  });
});

describe('thymian-report-input × report diff (#502)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'thymian-report-diff-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeReportFile(
    name: string,
    content: unknown,
  ): Promise<string> {
    const filePath = join(tmpDir, name);
    await writeFile(filePath, JSON.stringify(content), 'utf-8');
    return filePath;
  }

  it('carries the source-report identity into the diff envelope', async () => {
    const base = sampleReport({ toolName: 'diff-tool' });
    const head = sampleReport({ toolName: 'diff-tool' });
    const baseFile = await writeReportFile('base.json', base);
    const headFile = await writeReportFile('head.json', [head]);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportDiff({
      base: { type: 'thymian', location: baseFile },
      head: { type: 'thymian', location: headFile },
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.diff).toMatchObject({
      baseReportId: base.reportId,
      headReportId: head.reportId,
      baseCreatedAt: base.createdAt,
      headCreatedAt: head.createdAt,
    });

    await thymian.close();
  });

  it('diffing the same file against itself yields an empty change list', async () => {
    const report = sampleReport({ toolName: 'diff-tool' });
    const reportFile = await writeReportFile('same.json', report);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    const outcome = await thymian.reportDiff({
      base: { type: 'thymian', location: reportFile },
      head: { type: 'thymian', location: reportFile },
    });

    expect(outcome.diff?.changes).toEqual([]);

    await thymian.close();
  });

  it('rejects a multi-report file even when the sibling is run-less (#502 review)', async () => {
    const full = sampleReport({ toolName: 'full' });
    const runLess = { ...sampleReport({ toolName: 'empty' }), runs: [] };
    const reportFile = await writeReportFile('mixed.json', [runLess, full]);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportDiff({
        base: { type: 'thymian', location: reportFile },
        head: { type: 'thymian', location: reportFile },
      }),
    ).rejects.toThrow(/contains 2 reports/);

    await thymian.close();
  });

  it('rejects a single run-less report with a clear loader error', async () => {
    const runLess = { ...sampleReport({ toolName: 'empty' }), runs: [] };
    const emptyFile = await writeReportFile('empty.json', runLess);
    const fullFile = await writeReportFile(
      'full.json',
      sampleReport({ toolName: 'full' }),
    );
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportDiff({
        base: { type: 'thymian', location: emptyFile },
        head: { type: 'thymian', location: fullFile },
      }),
    ).rejects.toThrow(/no report in this file contains any run/);

    await thymian.close();
  });

  it('diffs the same file under two spellings to an empty change list', async () => {
    const report = sampleReport({ toolName: 'diff-tool' });
    await writeReportFile('same.json', report);
    const thymian = new Thymian(undefined, { cwd: tmpDir }).register(
      reporterPlugin,
      { formatters: {} },
    );
    await thymian.ready();

    const outcome = await thymian.reportDiff({
      base: { type: 'thymian', location: join(tmpDir, 'same.json') },
      head: { type: 'thymian', location: 'same.json' },
    });

    expect(outcome.diff?.changes).toEqual([]);

    await thymian.close();
  });

  it('rejects a multi-report file per side, pointing at report merge', async () => {
    const reportFile = await writeReportFile('multi.json', [
      sampleReport({ toolName: 'a' }),
      sampleReport({ toolName: 'b' }),
    ]);
    const thymian = new Thymian().register(reporterPlugin, { formatters: {} });
    await thymian.ready();

    await expect(
      thymian.reportDiff({
        base: { type: 'thymian', location: reportFile },
        head: { type: 'thymian', location: reportFile },
      }),
    ).rejects.toThrow(/contains 2 reports/);

    await thymian.close();
  });
});
