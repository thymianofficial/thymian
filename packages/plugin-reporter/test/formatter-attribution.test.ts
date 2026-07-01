import { describe, expect, it } from 'vitest';

import { reportToCsvLines } from '../src/formatters/csv.js';
import { TextFormatter } from '../src/formatters/text.js';

const report = {
  reportId: 'report-1',
  createdAt: new Date().toISOString(),
  runs: [
    {
      runId: 'run-1',
      tool: { name: 'tool' },
      runType: 'lint',
      runAt: new Date().toISOString(),
      rules: [{ id: 'rule/id', severity: 'warn' as const }],
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

describe('formatter attribution preservation', () => {
  it('keeps rule attribution in text and csv outputs', async () => {
    const formatter = new TextFormatter();
    formatter.init({ summaryOnly: false });
    formatter.report(report);

    const text = await formatter.flush();
    const csv = reportToCsvLines(report).join('');

    expect(text).toContain('rule/id');
    expect(csv).toContain('rule/id');
    expect(text).toContain('Problem');
    expect(csv).toContain('Problem');
  });
});
