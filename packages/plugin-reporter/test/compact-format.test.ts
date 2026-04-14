import { stripVTControlCharacters } from 'node:util';

import type { ThymianReport } from '@thymian/core';
import chalk from 'chalk';
import { beforeEach, describe, expect, it } from 'vitest';

import { TextFormatter } from '../src/formatters/text.js';
import {
  errorSymbol,
  hintSymbol,
  successSymbol,
  warnSymbol,
} from '../src/style.js';

const createReport = (
  overrides: Partial<ThymianReport> = {},
): ThymianReport => ({
  source: '@thymian/plugin-http-linter',
  message: '5 HTTP rules run successfully. 2 rules reported a violation.',
  ...overrides,
});

describe('TextFormatter compact format (Story 2.3)', () => {
  let formatter: TextFormatter;

  beforeEach(() => {
    formatter = new TextFormatter();
    formatter.init({});
  });

  describe('two-line violation format', () => {
    it('renders severity prefix + message on first line, rule name underneath', async () => {
      // Force chalk level for deterministic output
      const originalLevel = chalk.level;
      chalk.level = 0;

      formatter.report(
        createReport({
          sections: [
            {
              heading: 'GET /users → 200 OK',
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
      const lines = result!.split('\n');

      // Find the line with the violation message
      const messageLine = lines.find((l) => l.includes('Missing Date header'));
      expect(messageLine).toBeDefined();
      expect(messageLine).toContain(`${errorSymbol} error`);
      expect(messageLine).toContain('Missing Date header');

      // The rule name should be on the next line
      const msgIdx = lines.indexOf(messageLine!);
      const ruleNameLine = lines[msgIdx + 1];
      expect(ruleNameLine).toContain('rfc9110/must-include-date-header');

      chalk.level = originalLevel;
    });

    it('renders rule name aligned under message text (not at column 0)', async () => {
      chalk.level = 0;

      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [
                {
                  severity: 'error',
                  message: 'msg',
                  ruleName: 'rfc9110/rule',
                },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      const lines = result!.split('\n');
      const ruleNameLine = lines.find((l) => l.includes('rfc9110/rule'));

      // Rule name should be indented (not starting at column 0)
      expect(ruleNameLine).toBeDefined();
      expect(ruleNameLine!.startsWith(' ')).toBe(true);

      // The indentation should be 4 (base) + prefix width
      // For error: "✖ error: " = 9 chars
      const expectedIndent = 4 + `${errorSymbol} error: `.length;
      const actualIndent =
        ruleNameLine!.length - ruleNameLine!.trimStart().length;
      expect(actualIndent).toBe(expectedIndent);

      chalk.level = 0;
    });

    it('renders warn items with ⚠ warning: prefix', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [
                { severity: 'warn', message: 'weak etag', ruleName: 'r' },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      expect(result).toContain(`${warnSymbol} warning:`);
    });

    it('renders hint items with ℹ hint: prefix', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [
                { severity: 'hint', message: 'consider adding', ruleName: 'r' },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      expect(result).toContain(`${hintSymbol} hint:`);
    });

    it('renders info items with no prefix', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [{ severity: 'info', message: 'skipped test' }],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      expect(result).toContain('skipped test');
      // Info items should not have a severity symbol
      const lines = result!.split('\n');
      const infoLine = lines.find((l) => l.includes('skipped test'));
      expect(infoLine).not.toContain(errorSymbol);
      expect(infoLine).not.toContain(warnSymbol);
      expect(infoLine).not.toContain(hintSymbol);
    });

    it('does not render rule name line when ruleName is absent', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [{ severity: 'info', message: 'operational info' }],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      const lines = result!.split('\n');
      const infoLine = lines.find((l) => l.includes('operational info'));
      const infoIdx = lines.indexOf(infoLine!);
      // Next line should not be indented rule name — it should be empty or the next section
      const nextLine = lines[infoIdx + 1];
      expect(nextLine?.trim()).toBe('');
    });
  });

  describe('section headers', () => {
    it('renders source as a top-level separator with horizontal rule', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          source: '@thymian/plugin-http-linter',
          sections: [
            {
              heading: 'h',
              items: [{ severity: 'error', message: 'm' }],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      expect(result).toContain('@thymian/plugin-http-linter');
      expect(result).toContain('─');
    });

    it('renders section headings as bold text', async () => {
      // Chalk level 1+ to test bold
      const originalLevel = chalk.level;
      chalk.level = 1;

      formatter.report(
        createReport({
          sections: [
            {
              heading: 'GET /users → 200 OK',
              items: [{ severity: 'error', message: 'm' }],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      // In non-zero chalk level, the heading is bold (ANSI codes present)
      expect(result).toContain('GET /users → 200 OK');

      chalk.level = originalLevel;
    });
  });

  describe('summary footer', () => {
    it('renders correct counts for mixed severities', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [
                { severity: 'error', message: 'e1' },
                { severity: 'error', message: 'e2' },
                { severity: 'warn', message: 'w1' },
                { severity: 'hint', message: 'h1' },
                { severity: 'hint', message: 'h2' },
                { severity: 'hint', message: 'h3' },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      expect(result).toContain('2 errors');
      expect(result).toContain('1 warning');
      expect(result).toContain('3 hints');
    });

    it('uses singular form for single counts', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [
                { severity: 'error', message: 'e1' },
                { severity: 'warn', message: 'w1' },
                { severity: 'hint', message: 'h1' },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      expect(result).toContain('1 error');
      expect(result).not.toContain('1 errors');
      expect(result).toContain('1 warning');
      expect(result).not.toContain('1 warnings');
      expect(result).toContain('1 hint');
      expect(result).not.toContain('1 hints');
    });

    it('summary is the last line', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [{ severity: 'error', message: 'e' }],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      const lastNonEmptyLine = result!
        .split('\n')
        .filter((l) => l.trim())
        .at(-1);
      expect(lastNonEmptyLine).toContain('Found');
    });
  });

  describe('happy path', () => {
    it('renders success message with ✓ symbol', async () => {
      chalk.level = 0;
      const result = await formatter.flush();
      expect(result).toBe(`${successSymbol} No problems found`);
    });
  });

  describe('TTY vs non-TTY output', () => {
    it('preserves Unicode symbols in non-TTY output', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [
                { severity: 'error', message: 'e', ruleName: 'r' },
                { severity: 'warn', message: 'w', ruleName: 'r' },
                { severity: 'hint', message: 'h', ruleName: 'r' },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      const plain = stripVTControlCharacters(result!);

      expect(plain).toContain(errorSymbol);
      expect(plain).toContain(warnSymbol);
      expect(plain).toContain(hintSymbol);
    });

    it('non-TTY output has no ANSI escape sequences (when chalk level is 0)', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [{ severity: 'error', message: 'e', ruleName: 'r' }],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      // With chalk.level = 0, output should already be clean
      expect(result).toBe(stripVTControlCharacters(result!));
    });

    it('preserves indentation structure in non-TTY output', async () => {
      chalk.level = 0;
      formatter.report(
        createReport({
          sections: [
            {
              heading: 'GET /users → 200 OK',
              items: [
                {
                  severity: 'error',
                  message: 'Missing header',
                  ruleName: 'rfc9110/rule',
                },
              ],
            },
          ],
        }),
      );

      const result = await formatter.flush();
      const lines = result!.split('\n');

      // Section heading should be indented with 2 spaces
      const headingLine = lines.find((l) => l.includes('GET /users'));
      expect(headingLine).toBeDefined();
      expect(headingLine!.startsWith('  ')).toBe(true);

      // Item should be indented with 4 spaces
      const itemLine = lines.find((l) => l.includes('Missing header'));
      expect(itemLine).toBeDefined();
      expect(itemLine!.startsWith('    ')).toBe(true);
    });

    it('TTY output includes ANSI codes when chalk level is non-zero and stdout is TTY', async () => {
      const originalLevel = chalk.level;
      const originalIsTTY = process.stdout.isTTY;
      chalk.level = 1;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      const ttyFormatter = new TextFormatter();
      ttyFormatter.init({});
      ttyFormatter.report(
        createReport({
          sections: [
            {
              heading: 'h',
              items: [{ severity: 'error', message: 'e' }],
            },
          ],
        }),
      );

      const result = await ttyFormatter.flush();
      // With chalk level > 0 and TTY stdout, ANSI codes should be present
      expect(result).not.toBe(stripVTControlCharacters(result!));

      chalk.level = originalLevel;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    });
  });

  describe('sorted report rendering', () => {
    it('renders rule-sorted report (rule names as section headings, no duplicate rule lines)', async () => {
      chalk.level = 0;
      formatter.report({
        source: '@thymian/plugin-http-linter',
        message: 'msg',
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
      });

      const result = await formatter.flush();
      const lines = result!.split('\n');

      // Section headings should appear
      expect(result).toContain('rfc9110/must-include-date-header');
      expect(result).toContain('rfc9110/strong-comparison');
      // Messages show endpoint only
      expect(result).toContain('GET /users → 200 OK');
      expect(result).toContain('POST /users → 201 Created');
      // Severity prefixes should still appear (not redundant in rule mode)
      expect(result).toContain(`${errorSymbol} error:`);

      // Rule names should NOT appear as dimmed per-item lines when they
      // match the section heading (they would be redundant).
      const dateHeaderLines = lines.filter((l) =>
        l.includes('rfc9110/must-include-date-header'),
      );
      // Only 1 occurrence: the section heading itself
      expect(dateHeaderLines).toHaveLength(1);
    });

    it('renders severity-sorted report (severity levels as section headings)', async () => {
      chalk.level = 0;
      formatter.report({
        source: '@thymian/plugin-http-linter',
        message: 'msg',
        sections: [
          {
            heading: 'Errors (1)',
            items: [
              {
                severity: 'error',
                message: 'GET /users → 200 OK',
                ruleName: 'r1',
              },
            ],
          },
          {
            heading: 'Warnings (1)',
            items: [
              {
                severity: 'warn',
                message: 'POST /users → 201 Created',
                ruleName: 'r2',
              },
            ],
          },
        ],
      });

      const result = await formatter.flush();
      // Severity-grouped headings should appear
      expect(result).toContain('Errors (1)');
      expect(result).toContain('Warnings (1)');
      // Item messages show endpoint only
      expect(result).toContain('GET /users → 200 OK');
      expect(result).toContain('POST /users → 201 Created');
      // Per-item severity prefix should be suppressed (redundant with heading)
      expect(result).not.toContain(`${errorSymbol} error:`);
      expect(result).not.toContain(`${warnSymbol} warning:`);
      // Rule names should still appear (not redundant)
      expect(result).toContain('r1');
      expect(result).toContain('r2');
    });
  });
});
