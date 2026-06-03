import { reportToCsvLines } from '../src/formatters/csv.js';
import { MarkdownFormatter } from '../src/formatters/markdown.js';
import { TextFormatter } from '../src/formatters/text.js';
import { NoopLogger } from '@thymian/core';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const report = {
  reportId: 'report-1',
  createdAt: new Date().toISOString(),
  runs: [
    {
      runId: 'run-1',
      tool: { name: 'tool' },
      runType: 'analyze',
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

describe('formatter consistency for v4 reports', () => {
  it('renders the same finding identity across formatters', async () => {
    const text = new TextFormatter();
    text.init({ summaryOnly: false });
    text.report(report);

    const markdown = new MarkdownFormatter(new NoopLogger());
    markdown.init({ path: join(process.cwd(), 'tmp', 'consistency-report.md') });
    markdown.report(report);

    const textOutput = await text.flush();
    const csvOutput = reportToCsvLines(report).join('');
    await markdown.flush();

    expect(textOutput).toContain('rule/id');
    expect(csvOutput).toContain('rule/id');
  });
});
