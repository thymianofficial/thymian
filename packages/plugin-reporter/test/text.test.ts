import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatSeverityPrefix, TextFormatter } from '../src/formatters/text.js';
import {
  errorSymbol,
  hintSymbol,
  successSymbol,
  warnSymbol,
} from '../src/style.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('TextFormatter', () => {
  chalk.level = 0;

  const createReport = (
    overrides: Partial<ThymianReport> = {},
  ): ThymianReport => ({
    source: 'test-source',
    message: 'Test report',
    ...overrides,
  });

  let formatter: TextFormatter;

  beforeEach(() => {
    formatter = new TextFormatter();
    formatter.init({});
  });

  // ----- Happy path: no reports -----

  it('should return success message when no reports are present', async () => {
    const result = await formatter.flush();

    expect(result).toBe(`${successSymbol} No problems found`);
  });

  it('should include the ✓ symbol in the success message', async () => {
    const result = await formatter.flush();

    expect(result).toContain('✓');
    expect(result).toContain('No problems found');
  });

  // ----- Severity prefix formatting -----

  describe('formatSeverityPrefix', () => {
    it('should format warn severity as "warning:" (not "warn:")', () => {
      const prefix = formatSeverityPrefix('warn');

      expect(prefix).toContain('warning');
      expect(prefix).not.toContain('warn:');
      expect(prefix).toContain(warnSymbol);
    });

    it('should format error severity with error symbol', () => {
      const prefix = formatSeverityPrefix('error');

      expect(prefix).toContain('error');
      expect(prefix).toContain(errorSymbol);
    });

    it('should format hint severity with hint symbol', () => {
      const prefix = formatSeverityPrefix('hint');

      expect(prefix).toContain('hint');
      expect(prefix).toContain(hintSymbol);
    });

    it('should return empty string for info severity', () => {
      const prefix = formatSeverityPrefix('info');

      expect(prefix).toBe('');
    });

    it.each([
      ['error', errorSymbol],
      ['warn', warnSymbol],
      ['hint', hintSymbol],
    ] as [ThymianReportSeverity, string][])(
      'should include the correct symbol for %s severity',
      (severity, symbol) => {
        const prefix = formatSeverityPrefix(severity);

        expect(prefix).toContain(symbol);
      },
    );
  });

  // ----- Reports with findings -----

  it('should include report source in output', async () => {
    formatter.report(
      createReport({
        source: 'my-api.yaml',
        sections: [
          {
            heading: 'Issues',
            items: [{ severity: 'error', message: 'Missing field' }],
          },
        ],
      }),
    );

    const result = await formatter.flush();

    expect(result).toContain('my-api.yaml');
  });

  it('should use "warning" label in output for warn-severity items', async () => {
    formatter.report(
      createReport({
        sections: [
          {
            heading: 'Warnings',
            items: [{ severity: 'warn', message: 'Deprecated endpoint' }],
          },
        ],
      }),
    );

    const result = await formatter.flush();

    expect(result).toContain('warning');
    expect(result).toContain('Deprecated endpoint');
  });

  it('should include summary line with error, warning, and hint counts', async () => {
    formatter.report(
      createReport({
        sections: [
          {
            heading: 'Mixed',
            items: [
              { severity: 'error', message: 'Error item' },
              { severity: 'warn', message: 'Warn item' },
              { severity: 'hint', message: 'Hint item' },
            ],
          },
        ],
      }),
    );

    const result = await formatter.flush();

    expect(result).toContain('1 error');
    expect(result).toContain('1 warning');
    expect(result).toContain('1 hint');
  });

  it('should include rule name when present', async () => {
    formatter.report(
      createReport({
        sections: [
          {
            heading: 'Rules',
            items: [
              {
                severity: 'error',
                message: 'Missing Date header',
                ruleName: 'rfc9110/must-include-date-header',
              },
            ],
          },
        ],
      }),
    );

    const result = await formatter.flush();

    expect(result).toContain('rfc9110/must-include-date-header');
  });

  // ----- summaryOnly mode -----

  it('should only show summary in summaryOnly mode', async () => {
    formatter.init({ summaryOnly: true });

    formatter.report(
      createReport({
        source: 'should-not-appear.yaml',
        sections: [
          {
            heading: 'Details',
            items: [{ severity: 'error', message: 'Detailed error' }],
          },
        ],
      }),
    );

    const result = await formatter.flush();

    expect(result).not.toContain('should-not-appear.yaml');
    expect(result).toContain('1 error');
  });

  // ----- File output -----

  it('should write plain text to file when path option is set', async () => {
    formatter.init({ path: '/tmp/report.txt' });

    formatter.report(
      createReport({
        sections: [
          {
            heading: 'File test',
            items: [{ severity: 'error', message: 'File error' }],
          },
        ],
      }),
    );

    await formatter.flush();

    expect(mkdir).toHaveBeenCalledWith('/tmp', { recursive: true });
    expect(writeFile).toHaveBeenCalledOnce();
  });
});
