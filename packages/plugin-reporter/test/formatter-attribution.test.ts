import { reportToCsvLines } from '../src/formatters/csv.js';
import { TextFormatter } from '../src/formatters/text.js';
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
              severity: 'warn' as const,
              message: { text: 'Problem' },
            },
          ],
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
