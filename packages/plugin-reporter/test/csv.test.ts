import { csvSafe, reportToCsvLines } from '../src/formatters/csv.js';
import { describe, expect, it } from 'vitest';

const report = {
  reportId: 'report-1',
  createdAt: new Date().toISOString(),
  runs: [
    {
      runId: 'run-1',
      tool: { name: 'tool' },
      runType: 'lint',
      runAt: new Date().toISOString(),
      executions: [
        {
          location: { type: 'custom', value: 'GET /pets' },
          findings: [
            {
              id: 'finding-1',
              kind: 'rule-violation',
              ruleId: 'rule/id',
              title: 'Problem',
              severity: 'error' as const,
              message: { text: 'Problem' },
            },
          ],
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
