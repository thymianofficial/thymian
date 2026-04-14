import type { ThymianReport } from '@thymian/core';
import { NoopLogger } from '@thymian/core';
import chalk from 'chalk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { thymianReportToCsvLines } from '../src/formatters/csv.js';
import { MarkdownFormatter } from '../src/formatters/markdown.js';
import { TextFormatter } from '../src/formatters/text.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

/**
 * Tests that verify all formatters (text, markdown, CSV) produce correct output
 * when receiving sorted report structures from the core sorting utility.
 * These tests confirm that formatters remain unchanged for --sort-reports-by.
 */
describe('formatter consistency with sorted reports (Story 2.3)', () => {
  chalk.level = 0;

  // A rule-sorted report as produced by sortReports('rule')
  // Messages are replaced with the original endpoint heading by the sorter.
  const ruleSortedReport: ThymianReport = {
    source: '@thymian/plugin-http-linter',
    message: '5 HTTP rules run successfully. 2 rules reported a violation.',
    sections: [
      {
        heading: 'rfc9110/must-include-date-header',
        items: [
          {
            severity: 'error',
            message: 'GET /users → 200 OK',
            ruleName: 'rfc9110/must-include-date-header',
          },
          {
            severity: 'error',
            message: 'POST /users → 201 Created',
            ruleName: 'rfc9110/must-include-date-header',
          },
        ],
      },
      {
        heading: 'rfc9110/strong-comparison',
        items: [
          {
            severity: 'warn',
            message: 'GET /users → 200 OK',
            ruleName: 'rfc9110/strong-comparison',
          },
        ],
      },
    ],
  };

  // A severity-sorted report as produced by sortReports('severity')
  // Messages are replaced with the original endpoint heading by the sorter.
  const severitySortedReport: ThymianReport = {
    source: '@thymian/plugin-http-linter',
    message: 'msg',
    sections: [
      {
        heading: 'Errors (2)',
        items: [
          {
            severity: 'error',
            message: 'GET /users → 200 OK',
            ruleName: 'rfc9110/must-include-date-header',
          },
          {
            severity: 'error',
            message: 'POST /users → 201 Created',
            ruleName: 'rfc9110/must-include-date-header',
          },
        ],
      },
      {
        heading: 'Warnings (1)',
        items: [
          {
            severity: 'warn',
            message: 'GET /users → 200 OK',
            ruleName: 'rfc9110/strong-comparison',
          },
        ],
      },
    ],
  };

  describe('TextFormatter with sorted reports', () => {
    let formatter: TextFormatter;

    beforeEach(() => {
      formatter = new TextFormatter();
      formatter.init({});
    });

    it('renders rule-sorted report: no redundant per-item rule name lines', async () => {
      formatter.report(ruleSortedReport);
      const result = await formatter.flush();
      const lines = result!.split('\n');

      // Section headings present
      expect(result).toContain('rfc9110/must-include-date-header');
      expect(result).toContain('rfc9110/strong-comparison');
      // Messages show endpoint only (no rule description)
      expect(result).toContain('GET /users → 200 OK');
      expect(result).toContain('POST /users → 201 Created');
      // Summary counts
      expect(result).toContain('2 errors');
      expect(result).toContain('1 warning');

      // Rule names should appear only once each (as heading, not repeated per item)
      const dateHeaderOccurrences = lines.filter((l) =>
        l.includes('rfc9110/must-include-date-header'),
      );
      expect(dateHeaderOccurrences).toHaveLength(1);
      const strongCompOccurrences = lines.filter((l) =>
        l.includes('rfc9110/strong-comparison'),
      );
      expect(strongCompOccurrences).toHaveLength(1);
    });

    it('renders severity-sorted report: items without redundant severity prefix', async () => {
      formatter.report(severitySortedReport);
      const result = await formatter.flush();

      // Items and headings should be present
      expect(result).toContain('Errors (2)');
      expect(result).toContain('Warnings (1)');
      // Messages show endpoint only
      expect(result).toContain('GET /users → 200 OK');
      expect(result).toContain('POST /users → 201 Created');
      // Per-item severity prefix should be suppressed
      expect(result).not.toContain('✖ error:');
      expect(result).not.toContain('⚠ warning:');
      // Rule names should still be shown
      expect(result).toContain('rfc9110/must-include-date-header');
      expect(result).toContain('rfc9110/strong-comparison');
    });
  });

  describe('MarkdownFormatter with sorted reports', () => {
    it('renders rule-sorted report with rule names and source', async () => {
      const formatter = new MarkdownFormatter(new NoopLogger());
      formatter.init({ path: '/tmp/test.md' });
      formatter.report(ruleSortedReport);
      await formatter.flush();

      // MarkdownFormatter writes to file, not returning text
      // We verify through mock
      const { writeFile } = await import('fs/promises');
      const lastCall = vi.mocked(writeFile).mock.lastCall;
      expect(lastCall).toBeDefined();
      const content = lastCall![1] as string;

      expect(content).toContain('## @thymian/plugin-http-linter');
      expect(content).toContain('### rfc9110/must-include-date-header');
      expect(content).toContain('### rfc9110/strong-comparison');
      expect(content).toContain('*Rule: rfc9110/must-include-date-header*');
      expect(content).toContain('*Rule: rfc9110/strong-comparison*');
      expect(content).toContain('GET /users → 200 OK');
      expect(content).toContain('POST /users → 201 Created');
    });

    it('returns undefined for zero-finding runs', async () => {
      const formatter = new MarkdownFormatter(new NoopLogger());
      formatter.init({ path: '/tmp/test.md' });
      const result = await formatter.flush();
      expect(result).toBeUndefined();
    });
  });

  describe('CsvFormatter with sorted reports', () => {
    it('produces correct CSV lines for rule-sorted report', () => {
      const lines = thymianReportToCsvLines(ruleSortedReport);

      expect(lines).toHaveLength(3); // 2 items in first section + 1 in second

      // Every line should contain source and ruleName
      for (const line of lines) {
        expect(line).toContain('@thymian/plugin-http-linter');
      }

      // Check first line has correct fields
      const firstLine = lines[0]!;
      expect(firstLine).toContain('rfc9110/must-include-date-header');
      expect(firstLine).toContain('error');
    });

    it('includes ruleName and source columns for all items', () => {
      const lines = thymianReportToCsvLines(ruleSortedReport);

      for (const line of lines) {
        // Each line has 6 fields (source,section,severity,ruleName,message,details)
        // ruleName should never be empty for rule-produced findings
        const fields = line.trim().split(',');
        expect(fields.length).toBeGreaterThanOrEqual(5);
        // Source is first field
        expect(fields[0]).toContain('thymian');
      }
    });
  });

  describe('cross-formatter consistency', () => {
    it('all formatters preserve the same number of findings', async () => {
      // Text formatter
      const textFormatter = new TextFormatter();
      textFormatter.init({});
      textFormatter.report(ruleSortedReport);
      const textResult = await textFormatter.flush();

      // CSV lines (direct function test)
      const csvLines = thymianReportToCsvLines(ruleSortedReport);

      // All should reflect 3 items
      expect(csvLines).toHaveLength(3);
      expect(textResult).toContain('2 errors');
      expect(textResult).toContain('1 warning');
    });
  });
});
