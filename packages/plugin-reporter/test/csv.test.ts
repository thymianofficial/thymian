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

describe('CsvFormatter header (AC16)', () => {
  it('writes the exact 13-column header', async () => {
    const path = join(process.cwd(), 'tmp', 'csv-header.csv');
    const formatter = new CsvFormatter(new NoopLogger());
    await formatter.init({ path });
    await formatter.flush();

    const content = await readFile(path, 'utf-8');
    const [header] = content.split('\n');
    expect(header).toBe(CSV_HEADER);
    expect(CSV_HEADER.split(',')).toHaveLength(13);
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
