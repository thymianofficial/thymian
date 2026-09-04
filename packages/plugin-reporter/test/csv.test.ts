import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  NoopLogger,
  type RuleDescriptor,
  ThymianFormat,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  CsvFormatter,
  csvSafe,
  reportToCsvLines,
} from '../src/formatters/csv.js';
import { getFormatters } from '../src/get-formatters.js';

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
        const [formatter] = await getFormatters(
          { csv: { path: join(process.cwd(), 'tmp', `csv-${mode}.csv`) } },
          process.cwd(),
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
  it('writes the exact 13-column header', async () => {
    const path = join(process.cwd(), 'tmp', 'csv-header.csv');
    const formatter = new CsvFormatter(new NoopLogger());
    await formatter.init({ path });
    // The stream opens lazily on the first report — a run-less report still
    // produces the header-only file.
    await formatter.report(createReport([]));
    await formatter.flush();

    const content = await readFile(path, 'utf-8');
    const [header] = content.split('\n');
    expect(header).toBe(CSV_HEADER);
    expect(CSV_HEADER.split(',')).toHaveLength(13);
  });

  // /dev/full opens fine and fails every write with ENOSPC — the exact
  // "error after open" class the lazily opened stream must surface (the open
  // itself is already covered by openStream's rejection). Linux-only vehicle.
  const devFull = process.platform === 'linux' && existsSync('/dev/full');

  it.skipIf(!devFull)(
    'fails the pipeline when a data write errors after open',
    async () => {
      const formatter = new CsvFormatter(new NoopLogger());
      await formatter.init({ path: '/dev/full' });

      await expect(
        formatter.report(report).then(() => formatter.flush()),
      ).rejects.toThrow();
    },
  );

  it.skipIf(!devFull)(
    'fails flush() when only the header write errored (run-less report)',
    async () => {
      const formatter = new CsvFormatter(new NoopLogger());
      await formatter.init({ path: '/dev/full' });

      // A run-less report opens the stream and writes only the header; its
      // failure has no write callback to reject through, so it must be held
      // and thrown later. Let the async ENOSPC surface before flush looks.
      await formatter.report(createReport([]));
      await new Promise((resolve) => setTimeout(resolve, 50));

      await expect(formatter.flush()).rejects.toThrow(/ENOSPC/);
    },
  );

  it('writes no file at all when no report was ever received', async () => {
    const path = join(process.cwd(), 'tmp', 'csv-never-reported.csv');
    rmSync(path, { force: true });
    const formatter = new CsvFormatter(new NoopLogger());
    await formatter.init({ path });
    await formatter.flush();

    // Core withholds the report emission on a failed run (e.g. an unclaimed
    // report input) — no artifact may land on disk then (#507 review).
    expect(existsSync(path)).toBe(false);
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
