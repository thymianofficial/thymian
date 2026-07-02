import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { reportToCsvLines } from '../src/formatters/csv.js';
import { MarkdownFormatter } from '../src/formatters/markdown.js';

const report = {
  reportId: 'report-1',
  createdAt: new Date().toISOString(),
  runs: [
    {
      runId: 'run-1',
      tool: { name: 'tool' },
      runType: 'analyze',
      runAt: new Date().toISOString(),
      rules: [{ id: 'rule/id', severity: 'error' as const }],
      executions: [
        {
          kind: 'analyze' as const,
          ruleId: 'rule/id',
          status: { kind: 'failed' as const, reason: 'Problem' },
          location: { type: 'custom' as const, value: 'GET /pets' },
          findings: [],
        },
      ],
    },
  ],
};

describe('formatter consistency for v4 reports', () => {
  it('renders the same finding identity across formatters', async () => {
    const markdown = new MarkdownFormatter(new NoopLogger());
    markdown.init({
      path: join(process.cwd(), 'tmp', 'consistency-report.md'),
    });
    markdown.report(report);

    const csvOutput = reportToCsvLines(report).join('');
    const markdownOutput = await markdown.flush();

    expect(markdownOutput).toContain('rule/id');
    expect(csvOutput).toContain('rule/id');
  });
});
