import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createLintExecution,
  createToolRun,
  NoopLogger,
  type Report,
  type ToolRun,
} from '@thymian/core';
import { describe, expect, it, vitest } from 'vitest';

import { CsvFormatter } from '../src/formatters/csv.js';
import { JsonFormatter } from '../src/formatters/json.js';
import { MarkdownFormatter } from '../src/formatters/markdown.js';

const FIRST_RUN_DIRECTORY = '2026-08-25T10-30-00-123Z-a1b2c3d4';
const SECOND_RUN_DIRECTORY = '2026-08-25T10-31-00-000Z-99887766';

const CSV_HEADER =
  'run_id,run_type,tool,rule_id,location,row_type,status,severity,finding_kind,finding_id,title,message,detail';

/** A scratch `cwd` of its own per test, so run directories cannot collide. */
async function freshCwd(name: string): Promise<string> {
  const cwd = join(process.cwd(), 'tmp', name);
  await rm(cwd, { recursive: true, force: true });

  return cwd;
}

function reportFixture(overrides: Partial<Report> = {}): Report {
  return {
    reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
    createdAt: '2026-08-25T10:30:00.123Z',
    runs: [],
    ...overrides,
  };
}

/** A report that yields exactly one CSV row, labelled by `location`. */
function reportWithRow(location: string, overrides: Partial<Report> = {}) {
  return reportFixture({
    runs: [
      createToolRun({
        tool: { name: 'tool' },
        runType: 'lint',
        rules: [{ id: 'rule/id', severity: 'error' }],
        executions: [
          createLintExecution({
            ruleId: 'rule/id',
            status: { kind: 'failed', reason: 'Problem' },
            location: { type: 'custom', value: location },
          }),
        ],
      }),
    ],
    ...overrides,
  });
}

/**
 * A report whose `runs` cannot be read at all. Every formatter's rendering step
 * touches it — `analyze` for markdown, `JSON.stringify` for json,
 * `reportToCsvLines` for csv — while the naming fields it resolves its
 * destination from stay perfectly usable.
 */
function malformedReport(): Report {
  return {
    reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
    createdAt: '2026-08-25T10:30:00.123Z',
    get runs(): ToolRun[] {
      throw new Error('report is malformed');
    },
  };
}

/**
 * `ThymianEmitter.emit` is `void` — `core.report` subscribers are never awaited
 * — so a write started in `report()` is still in flight when `core.close`
 * flushes. `serve` calls `process.exit()` right after `core.close`, so anything
 * `flush()` has not awaited never reaches disk.
 */
describe('flush awaits writes started by an un-awaited report()', () => {
  it('leaves the markdown file on disk by the time flush resolves', async () => {
    const cwd = await freshCwd('lifecycle-markdown-flush');
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ cwd });

    void formatter.report(reportFixture());
    await formatter.flush();

    await expect(
      readFile(
        join(cwd, '.thymian', 'reports', FIRST_RUN_DIRECTORY, 'report.md'),
        'utf-8',
      ),
    ).resolves.toContain('# Thymian Report');
  });

  it('leaves the JSON file on disk by the time flush resolves', async () => {
    const cwd = await freshCwd('lifecycle-json-flush');
    const formatter = new JsonFormatter(new NoopLogger());
    formatter.init({ cwd });

    void formatter.report(reportFixture());
    await formatter.flush();

    await expect(
      readFile(
        join(cwd, '.thymian', 'reports', FIRST_RUN_DIRECTORY, 'report.json'),
        'utf-8',
      ),
    ).resolves.toContain('"reportId"');
  });

  it('leaves the CSV file on disk by the time flush resolves', async () => {
    const cwd = await freshCwd('lifecycle-csv-flush');
    const formatter = new CsvFormatter(new NoopLogger());
    formatter.init({ cwd });

    void formatter.report(reportFixture());
    await formatter.flush();

    await expect(
      readFile(
        join(cwd, '.thymian', 'reports', FIRST_RUN_DIRECTORY, 'report.csv'),
        'utf-8',
      ),
    ).resolves.toBe(`${CSV_HEADER}\n`);
  });
});

describe('CsvFormatter with two reports in flight at once', () => {
  it('writes both files completely and ends both streams', async () => {
    const cwd = await freshCwd('lifecycle-csv-overlap');
    const logger = new NoopLogger();
    const debugSpy = vitest.spyOn(logger, 'debug');
    const formatter = new CsvFormatter(logger);
    formatter.init({ cwd });

    // Both reports are handed over before either finishes. While the stream
    // lived in an instance field, the first call's `finally` closed whatever
    // was in the field — the second call's stream — and cleared it, so the
    // first stream was never ended (a leaked fd) and the debug line named the
    // wrong path.
    await Promise.all([
      formatter.report(reportWithRow('GET /pets')),
      formatter.report(
        reportWithRow('GET /orders', {
          reportId: '99887766-5544-4332-9110-aabbccddeeff',
          createdAt: '2026-08-25T10:31:00.000Z',
        }),
      ),
    ]);
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    expect((await readdir(reportsDir)).sort()).toEqual([
      FIRST_RUN_DIRECTORY,
      SECOND_RUN_DIRECTORY,
    ]);

    const first = join(reportsDir, FIRST_RUN_DIRECTORY, 'report.csv');
    const second = join(reportsDir, SECOND_RUN_DIRECTORY, 'report.csv');

    // Each file is complete: its own header AND its own row, not a mix.
    const firstContent = await readFile(first, 'utf-8');
    const secondContent = await readFile(second, 'utf-8');

    expect(firstContent.startsWith(`${CSV_HEADER}\n`)).toBe(true);
    expect(firstContent).toContain('GET /pets');
    expect(firstContent).not.toContain('GET /orders');
    expect(secondContent.startsWith(`${CSV_HEADER}\n`)).toBe(true);
    expect(secondContent).toContain('GET /orders');
    expect(secondContent).not.toContain('GET /pets');

    // The success line is only logged once a stream has been ended, so two
    // lines — each naming its own file — is the proof that both closed.
    expect(debugSpy).toHaveBeenCalledWith(`Wrote CSV report to ${first}`);
    expect(debugSpy).toHaveBeenCalledWith(`Wrote CSV report to ${second}`);
    expect(debugSpy).toHaveBeenCalledTimes(2);
  });
});

/**
 * Rendering used to sit outside the try/catch, so a report the renderer chokes
 * on threw straight out of `report()`, rejected the `Promise.all` in the
 * `core.report` handler and aborted the run — the exact outcome the guard's
 * comments promise cannot happen.
 */
describe('a report that makes rendering throw degrades like a write failure', () => {
  it('does not reject markdown report() and logs instead', async () => {
    const cwd = await freshCwd('lifecycle-markdown-render-throws');
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const formatter = new MarkdownFormatter(logger);
    formatter.init({ cwd });

    await expect(formatter.report(malformedReport())).resolves.toBeUndefined();
    await expect(formatter.flush()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write Markdown report to'),
    );
  });

  it('does not reject JSON report() and logs instead', async () => {
    const cwd = await freshCwd('lifecycle-json-render-throws');
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const formatter = new JsonFormatter(logger);
    formatter.init({ cwd });

    await expect(formatter.report(malformedReport())).resolves.toBeUndefined();
    await expect(formatter.flush()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write JSON report to'),
    );
  });

  it('does not reject CSV report(), logs, and still ends the stream', async () => {
    const cwd = await freshCwd('lifecycle-csv-render-throws');
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const debugSpy = vitest.spyOn(logger, 'debug');
    const formatter = new CsvFormatter(logger);
    formatter.init({ cwd });

    // CSV opens its destination before rendering, so a throwing renderer must
    // not walk out over an open stream.
    await expect(formatter.report(malformedReport())).resolves.toBeUndefined();
    await expect(formatter.flush()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write CSV report to'),
    );
    // Nothing is claimed as written when rendering never produced rows.
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('keeps serving later reports after one report fails to render', async () => {
    const cwd = await freshCwd('lifecycle-render-throws-cascade');
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ cwd });

    await formatter.report(malformedReport());
    await formatter.report(reportFixture());
    await formatter.flush();

    // The serialization chain survived the failure: the next report still ran.
    expect(await readdir(join(cwd, '.thymian', 'reports'))).toEqual([
      FIRST_RUN_DIRECTORY,
    ]);
  });
});
