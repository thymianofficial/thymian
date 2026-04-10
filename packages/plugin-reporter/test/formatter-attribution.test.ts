import type { Logger, ThymianReport } from '@thymian/core';
import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownFormatter } from '../src/formatters/markdown.js';
import { TextFormatter } from '../src/formatters/text.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

/** Minimal no-op logger satisfying the Logger interface for MarkdownFormatter. */
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const noopLogger: Logger = {
  namespace: '',
  level: 'silent',
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  out: noop,
  child: () => noopLogger,
};

/**
 * Formatter attribution preservation tests (AC 3).
 *
 * These tests feed the same ThymianReport to text, markdown, and CSV formatters
 * and verify each preserves the finding content and attribution (rule name,
 * severity, source, location) from the shared report model.
 */
describe('formatter attribution preservation', () => {
  chalk.level = 0;

  const sharedReport: ThymianReport = {
    source: '@thymian/plugin-http-linter',
    message: '5 HTTP rules run. 2 reported violations.',
    sections: [
      {
        heading: 'GET /users → 200 OK',
        items: [
          {
            severity: 'error',
            message: 'Missing Date header in response',
            ruleName: 'rfc9110/must-include-date-header',
            details: 'RFC 9110 Section 6.6.1 requires a Date header.',
            links: [
              {
                title: 'RFC 9110',
                url: 'https://www.rfc-editor.org/rfc/rfc9110#section-6.6.1',
              },
            ],
          },
          {
            severity: 'warn',
            message: 'Content-Type header is missing',
            ruleName: 'custom/content-type-required',
          },
        ],
      },
      {
        heading: 'POST /users → 201 Created',
        items: [
          {
            severity: 'hint',
            message: 'Consider adding Location header',
            ruleName: 'best-practice/location-header-on-create',
          },
        ],
      },
    ],
    metadata: { validationMode: 'lint' },
  };

  const reportWithoutRuleName: ThymianReport = {
    source: '@thymian/plugin-http-tester',
    message: '2 test cases skipped',
    sections: [
      {
        heading: 'Skipped test cases',
        items: [
          {
            severity: 'info',
            message: 'Test case A',
            details: 'No matching endpoint',
          },
        ],
      },
    ],
  };

  describe('TextFormatter', () => {
    let formatter: TextFormatter;

    beforeEach(() => {
      formatter = new TextFormatter();
      formatter.init({});
    });

    it('should preserve source attribution', async () => {
      formatter.report(sharedReport);
      const result = await formatter.flush();

      expect(result).toContain('@thymian/plugin-http-linter');
    });

    it('should preserve rule name for rule-originated items', async () => {
      formatter.report(sharedReport);
      const result = await formatter.flush();

      expect(result).toContain('rfc9110/must-include-date-header');
      expect(result).toContain('custom/content-type-required');
      expect(result).toContain('best-practice/location-header-on-create');
    });

    it('should preserve severity in output', async () => {
      formatter.report(sharedReport);
      const result = await formatter.flush();

      expect(result).toContain('error');
      expect(result).toContain('warning');
      expect(result).toContain('hint');
    });

    it('should preserve message content', async () => {
      formatter.report(sharedReport);
      const result = await formatter.flush();

      expect(result).toContain('Missing Date header in response');
      expect(result).toContain('Content-Type header is missing');
      expect(result).toContain('Consider adding Location header');
    });

    it('should preserve section headings', async () => {
      formatter.report(sharedReport);
      const result = await formatter.flush();

      expect(result).toContain('GET /users → 200 OK');
      expect(result).toContain('POST /users → 201 Created');
    });

    it('should handle items without ruleName gracefully', async () => {
      formatter.report(reportWithoutRuleName);
      const result = await formatter.flush();

      expect(result).toContain('Test case A');
      expect(result).not.toContain('undefined');
    });
  });

  describe('MarkdownFormatter', () => {
    let formatter: MarkdownFormatter;

    beforeEach(async () => {
      vi.mocked(writeFile).mockClear();
      formatter = new MarkdownFormatter(noopLogger);
      await formatter.init({ path: '/tmp/report.md' });
      vi.mocked(writeFile).mockResolvedValue();
    });

    it('should preserve source attribution as heading', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain('## @thymian/plugin-http-linter');
    });

    it('should preserve rule name for rule-originated items', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain('*Rule: rfc9110/must-include-date-header*');
      expect(content).toContain('*Rule: custom/content-type-required*');
      expect(content).toContain(
        '*Rule: best-practice/location-header-on-create*',
      );
    });

    it('should preserve severity badges', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain('**✖ error**');
      expect(content).toContain('**⚠ warning**');
      expect(content).toContain('**ℹ hint**');
    });

    it('should preserve message content', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain('Missing Date header in response');
      expect(content).toContain('Content-Type header is missing');
      expect(content).toContain('Consider adding Location header');
    });

    it('should preserve section headings', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain('### GET /users → 200 OK');
      expect(content).toContain('### POST /users → 201 Created');
    });

    it('should preserve details in collapsible block', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain(
        'RFC 9110 Section 6.6.1 requires a Date header.',
      );
    });

    it('should preserve links', async () => {
      formatter.report(sharedReport);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain(
        '[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#section-6.6.1)',
      );
    });

    it('should handle items without ruleName by not including Rule line', async () => {
      formatter.report(reportWithoutRuleName);
      await formatter.flush();

      const [, content] = vi.mocked(writeFile).mock.calls[0]!;
      expect(content).toContain('Test case A');
      expect(content).not.toContain('*Rule:');
    });
  });

  describe('cross-formatter consistency', () => {
    it('should preserve the same finding count across all formatters', async () => {
      // Text formatter
      const textFormatter = new TextFormatter();
      textFormatter.init({});
      textFormatter.report(sharedReport);
      const textResult = await textFormatter.flush();

      // All three rule-originated items should appear
      expect(textResult).toContain('rfc9110/must-include-date-header');
      expect(textResult).toContain('custom/content-type-required');
      expect(textResult).toContain('best-practice/location-header-on-create');

      // Markdown formatter
      const mdFormatter = new MarkdownFormatter(noopLogger);
      await mdFormatter.init({ path: '/tmp/report.md' });
      vi.mocked(writeFile).mockResolvedValue();
      mdFormatter.report(sharedReport);
      await mdFormatter.flush();

      const [, mdContent] =
        vi.mocked(writeFile).mock.calls[
          vi.mocked(writeFile).mock.calls.length - 1
        ]!;
      expect(mdContent).toContain('3 items');

      // CSV lines
      const { thymianReportToCsvLines } =
        await import('../src/formatters/csv.js');
      const csvLines = thymianReportToCsvLines(sharedReport);
      expect(csvLines).toHaveLength(3);
    });
  });
});
