import { describe, expect, it } from 'vitest';

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

describe('TextFormatter compact output', () => {
  it('supports summaryOnly mode for v4 reports', async () => {
    const formatter = new TextFormatter();
    formatter.init({ summaryOnly: true });
    formatter.report(report);

    const output = await formatter.flush();

    expect(output).toContain('Summary:');
    expect(output).not.toContain('GET /pets');
  });
});
