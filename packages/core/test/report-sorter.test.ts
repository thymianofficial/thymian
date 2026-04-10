import { describe, expect, it } from 'vitest';

import type {
  ThymianReport,
  ThymianReportItem,
} from '../src/events/report.event.js';
import { sortReports } from '../src/report-sorter.js';

function makeItem(
  overrides: Partial<ThymianReportItem> & {
    severity: ThymianReportItem['severity'];
    message: string;
  },
): ThymianReportItem {
  return {
    severity: overrides.severity,
    message: overrides.message,
    ...overrides,
  };
}

function makeReport(
  overrides: Partial<ThymianReport> & { source: string; message: string },
): ThymianReport {
  return {
    source: overrides.source,
    message: overrides.message,
    ...overrides,
  };
}

describe('sortReports', () => {
  describe('returns original reports when', () => {
    it('mode is undefined', () => {
      const reports = [makeReport({ source: 's', message: 'm', sections: [] })];
      expect(sortReports(reports, undefined)).toBe(reports);
    });

    it('reports array is empty', () => {
      const reports: ThymianReport[] = [];
      expect(sortReports(reports, 'rule')).toBe(reports);
    });
  });

  describe('rule sort mode', () => {
    const reports: ThymianReport[] = [
      makeReport({
        source: '@thymian/plugin-http-linter',
        message: '5 rules run. 2 reported violations.',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              makeItem({
                severity: 'error',
                message: 'Missing header',
                ruleName: 'rfc9110/must-include-header',
              }),
              makeItem({
                severity: 'warn',
                message: 'Weak etag',
                ruleName: 'rfc9110/strong-comparison',
              }),
            ],
          },
          {
            heading: 'POST /users → 201 Created',
            items: [
              makeItem({
                severity: 'error',
                message: 'Missing header on POST',
                ruleName: 'rfc9110/must-include-header',
              }),
            ],
          },
        ],
      }),
    ];

    it('groups items by rule name', () => {
      const result = sortReports(reports, 'rule');
      expect(result).toHaveLength(1);
      expect(result[0]!.sections).toHaveLength(2);

      const ruleSection = result[0]!.sections!.find(
        (s) => s.heading === 'rfc9110/must-include-header',
      );
      expect(ruleSection).toBeDefined();
      expect(ruleSection!.items).toHaveLength(2);
    });

    it('preserves all items without truncation', () => {
      const result = sortReports(reports, 'rule');
      const allItems = result[0]!.sections!.flatMap((s) => s.items);
      expect(allItems).toHaveLength(3);
    });

    it('uses rule name as section heading', () => {
      const result = sortReports(reports, 'rule');
      const headings = result[0]!.sections!.map((s) => s.heading);
      expect(headings).toContain('rfc9110/must-include-header');
      expect(headings).toContain('rfc9110/strong-comparison');
    });

    it('replaces item message with original endpoint heading', () => {
      const result = sortReports(reports, 'rule');
      const ruleSection = result[0]!.sections!.find(
        (s) => s.heading === 'rfc9110/must-include-header',
      );
      expect(ruleSection!.items[0]!.message).toBe('GET /users → 200 OK');
      expect(ruleSection!.items[1]!.message).toBe('POST /users → 201 Created');
    });

    it('combines source from multiple reports', () => {
      const multiReports: ThymianReport[] = [
        makeReport({
          source: '@thymian/plugin-http-linter',
          message: 'msg1',
          sections: [
            {
              heading: 'h1',
              items: [
                makeItem({ severity: 'error', message: 'm', ruleName: 'r1' }),
              ],
            },
          ],
        }),
        makeReport({
          source: '@thymian/plugin-http-tester',
          message: 'msg2',
          sections: [
            {
              heading: 'h2',
              items: [
                makeItem({ severity: 'warn', message: 'm', ruleName: 'r2' }),
              ],
            },
          ],
        }),
      ];

      const result = sortReports(multiReports, 'rule');
      expect(result[0]!.source).toContain('@thymian/plugin-http-linter');
      expect(result[0]!.source).toContain('@thymian/plugin-http-tester');
    });

    it('combines messages from multiple reports', () => {
      const multiReports: ThymianReport[] = [
        makeReport({
          source: 's1',
          message: 'msg1',
          sections: [
            {
              heading: 'h',
              items: [
                makeItem({ severity: 'error', message: 'm', ruleName: 'r' }),
              ],
            },
          ],
        }),
        makeReport({
          source: 's2',
          message: 'msg2',
          sections: [
            {
              heading: 'h',
              items: [
                makeItem({ severity: 'error', message: 'm', ruleName: 'r' }),
              ],
            },
          ],
        }),
      ];
      const result = sortReports(multiReports, 'rule');
      expect(result[0]!.message).toContain('msg1');
      expect(result[0]!.message).toContain('msg2');
    });

    it('handles items without ruleName using fallback group', () => {
      const reportsWithNoRule: ThymianReport[] = [
        makeReport({
          source: 's',
          message: 'm',
          sections: [
            {
              heading: 'h1',
              items: [
                makeItem({ severity: 'info', message: 'skipped test case' }),
              ],
            },
          ],
        }),
      ];
      const result = sortReports(reportsWithNoRule, 'rule');
      expect(result[0]!.sections).toHaveLength(1);
      expect(result[0]!.sections![0]!.heading).toBe('(no rule)');
    });
  });

  describe('endpoint sort mode', () => {
    const reports: ThymianReport[] = [
      makeReport({
        source: '@thymian/plugin-http-linter',
        message: 'msg',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              makeItem({ severity: 'error', message: 'err1', ruleName: 'r1' }),
              makeItem({ severity: 'warn', message: 'warn1', ruleName: 'r2' }),
            ],
            location: { format: { elementType: 'node', elementId: 'n1' } },
          },
          {
            heading: 'POST /users → 201 Created',
            items: [
              makeItem({ severity: 'error', message: 'err2', ruleName: 'r1' }),
            ],
          },
        ],
      }),
    ];

    it('groups by endpoint (section heading)', () => {
      const result = sortReports(reports, 'endpoint');
      expect(result).toHaveLength(1);
      expect(result[0]!.sections).toHaveLength(2);
      expect(result[0]!.sections![0]!.heading).toBe('GET /users → 200 OK');
      expect(result[0]!.sections![1]!.heading).toBe(
        'POST /users → 201 Created',
      );
    });

    it('preserves section location', () => {
      const result = sortReports(reports, 'endpoint');
      expect(result[0]!.sections![0]!.location).toEqual({
        format: { elementType: 'node', elementId: 'n1' },
      });
    });

    it('preserves all items in their sections', () => {
      const result = sortReports(reports, 'endpoint');
      expect(result[0]!.sections![0]!.items).toHaveLength(2);
      expect(result[0]!.sections![1]!.items).toHaveLength(1);
    });

    it('merges items from duplicate headings across reports', () => {
      const multiReports: ThymianReport[] = [
        makeReport({
          source: 's1',
          message: 'm1',
          sections: [
            {
              heading: 'GET /users → 200 OK',
              items: [
                makeItem({ severity: 'error', message: 'a', ruleName: 'r1' }),
              ],
            },
          ],
        }),
        makeReport({
          source: 's2',
          message: 'm2',
          sections: [
            {
              heading: 'GET /users → 200 OK',
              items: [
                makeItem({ severity: 'warn', message: 'b', ruleName: 'r2' }),
              ],
            },
          ],
        }),
      ];

      const result = sortReports(multiReports, 'endpoint');
      expect(result[0]!.sections).toHaveLength(1);
      expect(result[0]!.sections![0]!.items).toHaveLength(2);
    });

    it('does not alter item messages (endpoint is already the heading)', () => {
      const result = sortReports(reports, 'endpoint');
      expect(result[0]!.sections![0]!.items[0]!.message).toBe('err1');
    });
  });

  describe('severity sort mode', () => {
    const reports: ThymianReport[] = [
      makeReport({
        source: '@thymian/plugin-http-linter',
        message: 'msg',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              makeItem({ severity: 'hint', message: 'hint1', ruleName: 'r3' }),
              makeItem({ severity: 'error', message: 'err1', ruleName: 'r1' }),
              makeItem({ severity: 'warn', message: 'warn1', ruleName: 'r2' }),
            ],
          },
          {
            heading: 'POST /users → 201 Created',
            items: [
              makeItem({ severity: 'error', message: 'err2', ruleName: 'r1' }),
              makeItem({ severity: 'info', message: 'info1' }),
            ],
          },
        ],
      }),
    ];

    it('groups by severity level', () => {
      const result = sortReports(reports, 'severity');
      expect(result).toHaveLength(1);
      const headings = result[0]!.sections!.map((s) => s.heading);
      expect(headings).toEqual([
        'Errors (2)',
        'Warnings (1)',
        'Hints (1)',
        'Info (1)',
      ]);
    });

    it('sorts severity sections in order: error → warn → hint → info', () => {
      const result = sortReports(reports, 'severity');
      const headings = result[0]!.sections!.map((s) => s.heading);
      expect(headings[0]).toBe('Errors (2)');
      expect(headings[1]).toBe('Warnings (1)');
      expect(headings[2]).toBe('Hints (1)');
      expect(headings[3]).toBe('Info (1)');
    });

    it('groups all errors together', () => {
      const result = sortReports(reports, 'severity');
      const errorSection = result[0]!.sections!.find((s) =>
        s.heading.startsWith('Errors'),
      );
      expect(errorSection!.items).toHaveLength(2);
    });

    it('preserves all items', () => {
      const result = sortReports(reports, 'severity');
      const totalItems = result[0]!.sections!.reduce(
        (sum, s) => sum + s.items.length,
        0,
      );
      expect(totalItems).toBe(5);
    });

    it('replaces item message with original endpoint heading', () => {
      const result = sortReports(reports, 'severity');
      const errorSection = result[0]!.sections!.find((s) =>
        s.heading.startsWith('Errors'),
      );
      expect(errorSection!.items[0]!.message).toBe('GET /users → 200 OK');
      expect(errorSection!.items[1]!.message).toBe('POST /users → 201 Created');
    });
  });

  describe('sorted reports are valid ThymianReport structures', () => {
    const reports: ThymianReport[] = [
      makeReport({
        source: '@thymian/plugin-http-linter',
        message: 'msg',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              makeItem({ severity: 'error', message: 'err', ruleName: 'r1' }),
              makeItem({ severity: 'warn', message: 'warn', ruleName: 'r2' }),
            ],
          },
        ],
      }),
    ];

    it.each(['rule', 'endpoint', 'severity'] as const)(
      '%s mode produces reports with source, message, and sections',
      (mode) => {
        const result = sortReports(reports, mode);
        for (const report of result) {
          expect(report.source).toBeTruthy();
          expect(typeof report.message).toBe('string');
          expect(Array.isArray(report.sections)).toBe(true);
          for (const section of report.sections!) {
            expect(section.heading).toBeTruthy();
            expect(Array.isArray(section.items)).toBe(true);
            for (const item of section.items) {
              expect(item.severity).toBeTruthy();
              expect(item.message).toBeTruthy();
            }
          }
        }
      },
    );
  });

  describe('summaryOnly orthogonality', () => {
    it('sorting does not affect summaryOnly behavior — sorting just reshapes, summary is formatter concern', () => {
      const reports: ThymianReport[] = [
        makeReport({
          source: 's',
          message: 'm',
          sections: [
            {
              heading: 'h',
              items: [
                makeItem({ severity: 'error', message: 'e', ruleName: 'r' }),
              ],
            },
          ],
        }),
      ];
      // Sorting still produces a report with sections even when summaryOnly would skip rendering them
      // This test confirms sorting doesn't break the report structure that summaryOnly relies on
      const result = sortReports(reports, 'rule');
      expect(result[0]!.sections).toBeDefined();
      expect(result[0]!.sections!.length).toBeGreaterThan(0);
    });
  });
});
