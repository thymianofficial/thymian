import { existsSync } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  NoopLogger,
  type Report,
  type RuleDescriptor,
  ThymianFormat,
} from '@thymian/core';
import { describe, expect, it, vitest } from 'vitest';

import {
  CsvFormatter,
  csvSafe,
  reportToCsvLines,
} from '../src/formatters/csv.js';
import { getFormatters } from '../src/get-formatters.js';
import { defaultRunDirectoryName } from '../src/report-file-name.js';

const CSV_HEADER =
  'run_id,run_type,tool,rule_id,location,row_type,status,severity,finding_kind,finding_id,title,message,detail';

const report = {
  reportId: 'report-1',
  createdAt: new Date().toISOString(),
  runs: [
    {
      runId: 'run-1',
      tool: { name: 'tool' },
      runType: 'lint',
      runAt: new Date().toISOString(),
      rules: [{ id: 'rule/id', severity: 'error' as const }],
      executions: [
        {
          kind: 'lint' as const,
          ruleId: 'rule/id',
          status: { kind: 'failed' as const, reason: 'Problem' },
          location: { type: 'custom' as const, value: 'GET /pets' },
          findings: [],
        },
      ],
    },
  ],
};

describe('CSV formatter helpers', () => {
  it('serializes report findings into CSV rows', () => {
    const lines = reportToCsvLines(report);
    expect(lines[0]).toContain('run-1');
    expect(lines[0]).toContain('rule/id');
  });

  it('escapes CSV cells', () => {
    expect(csvSafe('hello, world')).toBe('"hello, world"');
  });
});

describe('CsvFormatter ignores --sort-reports-by (flag-invariant)', () => {
  it('produces byte-identical CSV for every sort mode', async () => {
    const outputs = await Promise.all(
      (['endpoint', 'rule', 'severity'] as const).map(async (mode) => {
        // One cwd per mode: the run directory is derived from the report, so
        // three formatters sharing a cwd would fight over one file.
        const cwd = join(process.cwd(), 'tmp', `csv-${mode}`);
        await rm(cwd, { recursive: true, force: true });

        const [formatter] = await getFormatters(
          { csv: {} },
          cwd,
          new NoopLogger(),
          mode,
        );
        await formatter!.report(report);
        return (await formatter!.flush()) ?? '';
      }),
    );

    // Grouping is a presentation concern; the flat CSV export never changes.
    expect(outputs[1]).toBe(outputs[0]);
    expect(outputs[2]).toBe(outputs[0]);
  });
});

describe('CsvFormatter header (AC16)', () => {
  it('writes the exact 13-column header even for a report with no rows', async () => {
    const cwd = join(process.cwd(), 'tmp', 'csv-header');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new CsvFormatter(new NoopLogger());
    formatter.init({ cwd });
    // A report with no runs yields no rows at all — the header still has to be
    // on disk, so the destination must be opened before the empty-rows guard.
    await formatter.report({
      reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      createdAt: '2026-08-25T10:30:00.123Z',
      runs: [],
    });
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const [runDirectory = ''] = await readdir(reportsDir);
    const content = await readFile(
      join(reportsDir, runDirectory, 'report.csv'),
      'utf-8',
    );

    const [header] = content.split('\n');
    expect(header).toBe(CSV_HEADER);
    expect(CSV_HEADER.split(',')).toHaveLength(13);
  });

  // /dev/full opens fine and fails every write with ENOSPC — the exact
  // "error after open" class the lazily opened stream must surface (the open
  // itself is already covered by openStream's rejection). Linux-only vehicle.
  //
  // A formatter no longer takes a destination, so /dev/full cannot be handed to
  // it directly: the run directory's report.csv is symlinked onto /dev/full
  // instead, which aims the write the formatter derives for itself at it.
  const devFull = process.platform === 'linux' && existsSync('/dev/full');

  /**
   * Pre-create `report`'s own run directory with its report.csv pointing at
   * /dev/full. `defaultRunDirectoryName` memoizes per report object, so the
   * name resolved here is the one the formatter resolves for the same object.
   */
  async function aimRunDirectoryAtDevFull(
    cwd: string,
    target: Report,
  ): Promise<void> {
    const runDirectory = join(
      cwd,
      '.thymian',
      'reports',
      defaultRunDirectoryName(target),
    );
    await mkdir(runDirectory, { recursive: true });
    await symlink('/dev/full', join(runDirectory, 'report.csv'));
  }

  it.skipIf(!devFull)(
    'degrades a data write that errors after open, and claims nothing',
    async () => {
      const cwd = join(process.cwd(), 'tmp', 'csv-dev-full-rows');
      await rm(cwd, { recursive: true, force: true });
      await aimRunDirectoryAtDevFull(cwd, report);

      const logger = new NoopLogger();
      const errorSpy = vitest.spyOn(logger, 'error');
      const infoSpy = vitest.spyOn(logger, 'info');
      const formatter = new CsvFormatter(logger);
      formatter.init({ cwd });

      // An in-flight failure degrades rather than throwing: by now the findings
      // exist, and aborting the run would destroy output that is still useful.
      // Only the registration-time reportsDir precondition fails hard — see
      // get-formatters.test.ts.
      await expect(formatter.report(report)).resolves.toBeUndefined();
      await expect(formatter.flush()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write CSV report to'),
      );
      expect(infoSpy).not.toHaveBeenCalled();
    },
  );

  it.skipIf(!devFull)(
    'degrades when only the header write errored (run-less report)',
    async () => {
      const cwd = join(process.cwd(), 'tmp', 'csv-dev-full-header');
      await rm(cwd, { recursive: true, force: true });
      const runLess = createReport([]);
      await aimRunDirectoryAtDevFull(cwd, runLess);

      const logger = new NoopLogger();
      const errorSpy = vitest.spyOn(logger, 'error');
      const infoSpy = vitest.spyOn(logger, 'info');
      const formatter = new CsvFormatter(logger);
      formatter.init({ cwd });

      // A run-less report opens the stream and writes only the header; that
      // failure has no write callback to surface through, so it arrives through
      // the stream's error listener. Let the async ENOSPC land before asserting.
      await formatter.report(runLess);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The zero-row short-circuit must not claim a header that never landed.
      await expect(formatter.flush()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write CSV report to'),
      );
      expect(infoSpy).not.toHaveBeenCalled();
    },
  );

  it('writes no file at all when no report was ever received', async () => {
    const cwd = join(process.cwd(), 'tmp', 'csv-never-reported');
    await rm(cwd, { recursive: true, force: true });
    const formatter = new CsvFormatter(new NoopLogger());
    formatter.init({ cwd });
    await formatter.flush();

    // Core withholds the report emission on a failed run (e.g. an unclaimed
    // report input) — no artifact may land on disk then (#507 review). A
    // destination is derived per report, so with no report there is no run
    // directory either.
    expect(existsSync(join(cwd, '.thymian', 'reports'))).toBe(false);
  });
});

describe('CSV model alignment (AC16)', () => {
  const rules: RuleDescriptor[] = [
    { id: 'order-lifecycle', severity: 'error' },
  ];

  const testReport = createReport([
    createToolRun({
      tool: { name: '@thymian/plugin-http-tester' },
      runType: 'test',
      rules,
      executions: [
        createTestCaseExecution({
          name: 'Create order then fetch it',
          ruleId: 'order-lifecycle',
          status: { kind: 'failed', reason: 'Fetch failed' },
          steps: [
            createTestStep({
              name: 'Step 1',
              location: { type: 'custom', value: 'GET /orders/{id}' },
              findings: [
                {
                  id: 'af-1',
                  kind: 'assertion-failure',
                  title: 'status mismatch',
                  expected: 200,
                  actual: 404,
                },
              ],
            }),
          ],
        }),
      ],
    }),
  ]);

  it('emits an execution row and a finding row with inherited rule_id and expected/actual detail', () => {
    const lines = reportToCsvLines(testReport);

    const executionRow = lines.find(
      (l) => l.includes(',execution,failed,') && l.includes('order-lifecycle'),
    );
    expect(executionRow).toBeDefined();
    expect(executionRow).toContain(',execution,');

    const findingRow = lines.find((l) => l.includes('af-1'));
    expect(findingRow).toBeDefined();
    expect(findingRow).toContain('order-lifecycle');
    expect(findingRow).toContain('GET /orders/{id}');
    expect(findingRow).toContain('finding');
    expect(findingRow).toContain('assertion-failure');
    expect(findingRow).toContain('expected=200');
    expect(findingRow).toContain('actual=404');
  });

  it('emits a finding row for assertion-failure findings on analyze executions (BaggersIO PR-311 finding 2; markdown was the gap, CSV already covers this)', () => {
    const analyzeReport = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-analyzer' },
        runType: 'analyze',
        rules,
        executions: [
          createAnalyzeExecution({
            location: { type: 'custom', value: 'POST /orders' },
            ruleId: 'order-lifecycle',
            status: { kind: 'failed', reason: '1 assertion(s) failed' },
            findings: [
              {
                id: 'af-analyze-1',
                kind: 'assertion-failure',
                title: 'status mismatch',
                expected: 200,
                actual: 404,
              },
            ],
          }),
        ],
      }),
    ]);

    const lines = reportToCsvLines(analyzeReport);
    const findingRow = lines.find((l) => l.includes('af-analyze-1'));

    expect(findingRow).toBeDefined();
    expect(findingRow).toContain('assertion-failure');
    expect(findingRow).toContain('expected=200');
    expect(findingRow).toContain('actual=404');
  });
});

describe('CSV thymianFormat location resolution (BaggersIO PR-311 finding 5)', () => {
  it('resolves a thymianFormat location to an endpoint string, matching markdown/CLI instead of the raw format:{elementId} form', () => {
    const format = new ThymianFormat();
    const requestId = format.addRequest({
      sourceName: 'openapi.yaml',
      protocol: 'https',
      host: 'api.example.com',
      port: 443,
      method: 'post',
      path: '/orders',
      mediaType: '',
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {},
    });

    const report = createReport(
      [
        createToolRun({
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          thymianFormatVersion: 'v1',
          executions: [
            createLintExecution({
              location: {
                type: 'thymianFormat',
                elementType: 'node',
                elementId: requestId,
                pointer: '',
              },
              status: { kind: 'failed', reason: 'broken' },
            }),
          ],
        }),
      ],
      { v1: format.export() },
    );

    const lines = reportToCsvLines(report);
    const executionRow = lines.find((l) => l.includes(',execution,'));

    expect(executionRow).toBeDefined();
    expect(executionRow).toContain('POST /orders');
    expect(executionRow).not.toContain(`format:${requestId}`);
  });
});

describe('CsvFormatter derived run directory', () => {
  it('opens lazily and still writes a header for a report with no rows', async () => {
    const cwd = join(process.cwd(), 'tmp', 'csv-derived-empty-report');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new CsvFormatter(new NoopLogger());
    formatter.init({ cwd });
    await formatter.report({
      reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      createdAt: '2026-08-25T10:30:00.123Z',
      runs: [],
    });
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const [runDirectory = ''] = await readdir(reportsDir);

    expect(runDirectory).toBe('2026-08-25T10-30-00-123Z-a1b2c3d4');
    await expect(
      readFile(join(reportsDir, runDirectory, 'report.csv'), 'utf-8'),
    ).resolves.toBe(`${CSV_HEADER}\n`);
  });

  it('gives two reports of one session two run directories', async () => {
    // The `serve` defect: one plugin instance serves every workflow, so a
    // destination pinned on the first report wrote workflow 2 into workflow 1's
    // directory — or not at all.
    const cwd = join(process.cwd(), 'tmp', 'csv-two-reports');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new CsvFormatter(new NoopLogger());
    formatter.init({ cwd });
    await formatter.report({
      reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      createdAt: '2026-08-25T10:30:00.123Z',
      runs: [],
    });
    await formatter.report({
      reportId: '99887766-5544-4332-9110-aabbccddeeff',
      createdAt: '2026-08-25T10:31:00.000Z',
      runs: [],
    });
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');

    // Each directory is named after its OWN report, not after the first one.
    expect((await readdir(reportsDir)).sort()).toEqual([
      '2026-08-25T10-30-00-123Z-a1b2c3d4',
      '2026-08-25T10-31-00-000Z-99887766',
    ]);
    await expect(
      readFile(
        join(reportsDir, '2026-08-25T10-30-00-123Z-a1b2c3d4', 'report.csv'),
        'utf-8',
      ),
    ).resolves.toBe(`${CSV_HEADER}\n`);
    await expect(
      readFile(
        join(reportsDir, '2026-08-25T10-31-00-000Z-99887766', 'report.csv'),
        'utf-8',
      ),
    ).resolves.toBe(`${CSV_HEADER}\n`);
  });

  it('writes nothing when no report arrived', async () => {
    const cwd = join(process.cwd(), 'tmp', 'csv-derived-no-report');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new CsvFormatter(new NoopLogger());
    formatter.init({ cwd });

    await expect(formatter.flush()).resolves.toBeUndefined();
    await expect(readdir(join(cwd, '.thymian', 'reports'))).rejects.toThrow();
  });
});

describe('CsvFormatter unwritable destination', () => {
  /**
   * Make a destination that cannot be created, portably: put an existing *file*
   * where a directory has to go, so `mkdir` fails with `ENOTDIR`. `chmod` would
   * be no help — it is a no-op for root (CI containers) and unsupported on
   * Windows.
   */
  async function blockingFile(name: string): Promise<string> {
    const blocker = join(process.cwd(), 'tmp', name);
    await rm(blocker, { force: true, recursive: true });
    await mkdir(dirname(blocker), { recursive: true });
    await writeFile(blocker, 'this is a file, not a directory', 'utf-8');

    return blocker;
  }

  it('goes inert instead of throwing out of report and flush', async () => {
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const formatter = new CsvFormatter(logger);

    // The destination is derived under `cwd`, whose `.thymian/reports/<run>`
    // cannot be created because `cwd` itself is a file.
    formatter.init({ cwd: await blockingFile('csv-unwritable') });

    // `report()` runs inside the `core.report` handler and `flush()` inside the
    // `core.close` action, before it replies — neither may reject.
    await expect(formatter.report(report)).resolves.toBeUndefined();
    await expect(formatter.flush()).resolves.toBeUndefined();

    // Degraded, not silently swallowed.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write CSV report to'),
    );
  });

  it('does not let one unwritable report cascade into the next', async () => {
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const formatter = new CsvFormatter(logger);

    formatter.init({ cwd: await blockingFile('csv-unwritable-cascade') });

    await expect(formatter.report(report)).resolves.toBeUndefined();
    await expect(formatter.report(report)).resolves.toBeUndefined();
    await expect(formatter.flush()).resolves.toBeUndefined();

    // Every report resolves — and therefore retries — its own destination, so
    // each failure is reported once rather than one poisoning the rest.
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
