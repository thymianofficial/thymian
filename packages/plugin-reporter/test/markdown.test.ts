import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { MarkdownFormatter } from '../src/formatters/markdown.js';

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

describe('MarkdownFormatter', () => {
  it('writes markdown from a v4 report and returns its content', async () => {
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ path: join(process.cwd(), 'tmp', 'report.md') });
    formatter.report(report);

    const output = await formatter.flush();

    expect(output).toContain('# Thymian Report');
    expect(output).toContain('rule/id');
    expect(output).toContain('Problem');
  });
});
