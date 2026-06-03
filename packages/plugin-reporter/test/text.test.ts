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
              severity: 'error' as const,
              message: { text: 'Problem' },
            },
          ],
        },
      ],
    },
  ],
};

describe('TextFormatter', () => {
  it('renders report content from v4 reports', async () => {
    const formatter = new TextFormatter();
    formatter.init({ summaryOnly: false });
    formatter.report(report);

    const output = await formatter.flush();

    expect(output).toContain('tool');
    expect(output).toContain('Problem');
  });
});
