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

describe('MarkdownFormatter', () => {
  it('writes markdown from a v4 report', async () => {
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ path: join(process.cwd(), 'tmp', 'report.md') });
    formatter.report(report);

    await expect(formatter.flush()).resolves.toBeUndefined();
  });
});
