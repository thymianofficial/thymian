import type { ThymianReport } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { csvSafe, thymianReportToCsvLines } from '../src/formatters/csv.js';

describe('CsvFormatter utilities', () => {
  describe('csvSafe', () => {
    it('should return empty string for undefined', () => {
      expect(csvSafe(undefined)).toBe('');
    });

    it('should return the string unchanged when no special characters', () => {
      expect(csvSafe('simple')).toBe('simple');
    });

    it('should wrap in quotes when string contains comma', () => {
      expect(csvSafe('hello,world')).toBe('"hello,world"');
    });

    it('should wrap in quotes when string contains spaces', () => {
      expect(csvSafe('hello world')).toBe('"hello world"');
    });

    it('should double-escape internal quotes', () => {
      expect(csvSafe('say "hello"')).toBe('"say ""hello"""');
    });

    it('should replace newlines with spaces', () => {
      expect(csvSafe('line1\nline2')).toBe('"line1 line2"');
    });
  });

  describe('thymianReportToCsvLines', () => {
    it('should produce a single row for a report with no sections', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: 'All clear.',
      };

      const lines = thymianReportToCsvLines(report);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('@thymian/plugin-http-linter');
      expect(lines[0]).toContain('All clear.');
    });

    it('should produce a single row for a report with empty sections', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: 'Empty sections.',
        sections: [],
      };

      const lines = thymianReportToCsvLines(report);

      expect(lines).toHaveLength(1);
    });

    it('should produce one row per item with full attribution', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: 'Findings.',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              {
                severity: 'error',
                message: 'Missing Date header',
                ruleName: 'rfc9110/must-include-date-header',
                details: 'RFC 9110 requires Date header.',
              },
              {
                severity: 'warn',
                message: 'Missing Content-Type',
                ruleName: 'custom/content-type-required',
              },
            ],
          },
        ],
      };

      const lines = thymianReportToCsvLines(report);

      expect(lines).toHaveLength(2);

      // First row: source, section heading, severity, ruleName, message, details
      expect(lines[0]).toContain('@thymian/plugin-http-linter');
      expect(lines[0]).toContain('error');
      expect(lines[0]).toContain('rfc9110/must-include-date-header');
      expect(lines[0]).toContain('Missing Date header');

      // Second row
      expect(lines[1]).toContain('warn');
      expect(lines[1]).toContain('custom/content-type-required');
    });

    it('should handle items without ruleName (operational items)', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-tester',
        message: 'Skipped tests.',
        sections: [
          {
            heading: 'Skipped test cases',
            items: [
              {
                severity: 'info',
                message: 'Test case skipped',
                details: 'No matching endpoint',
              },
            ],
          },
        ],
      };

      const lines = thymianReportToCsvLines(report);

      expect(lines).toHaveLength(1);
      // ruleName column should be empty
      expect(lines[0]).toContain('info');
      expect(lines[0]).toContain('Test case skipped');
    });

    it('should produce rows for multiple sections', () => {
      const report: ThymianReport = {
        source: 'test-source',
        message: 'Multi-section.',
        sections: [
          {
            heading: 'Section A',
            items: [
              { severity: 'error', message: 'Error A', ruleName: 'rule-a' },
            ],
          },
          {
            heading: 'Section B',
            items: [
              { severity: 'warn', message: 'Warn B', ruleName: 'rule-b' },
              { severity: 'hint', message: 'Hint B', ruleName: 'rule-c' },
            ],
          },
        ],
      };

      const lines = thymianReportToCsvLines(report);

      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('Section A');
      expect(lines[1]).toContain('Section B');
      expect(lines[2]).toContain('Section B');
    });

    it('should preserve the CSV column order: source, section, severity, ruleName, message, details', () => {
      const report: ThymianReport = {
        source: 'src',
        message: 'msg',
        sections: [
          {
            heading: 'hd',
            items: [
              {
                severity: 'error',
                message: 'err-msg',
                ruleName: 'rule-1',
                details: 'dtl',
              },
            ],
          },
        ],
      };

      const lines = thymianReportToCsvLines(report);
      const columns = lines[0]!.trim().split(',');

      expect(columns[0]).toBe('src');
      expect(columns[1]).toBe('hd');
      expect(columns[2]).toBe('error');
      expect(columns[3]).toBe('rule-1');
      expect(columns[4]).toBe('err-msg');
      expect(columns[5]).toBe('dtl');
    });
  });
});
