import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Report } from '@thymian/core';
import {
  createLintExecution,
  createReport,
  createToolRun,
  Thymian,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
