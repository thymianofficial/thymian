import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  NoopLogger,
  type RuleDescriptor,
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
  it('serializes v4 report findings into CSV rows', () => {
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
});
