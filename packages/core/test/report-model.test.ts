import Ajv from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import type {
  ThymianReport,
  ThymianReportItem,
  ThymianReportLocation,
  ThymianReportSection,
  ThymianReportSeverity,
} from '../src/events/report.event.js';
import { thymianReportSchema } from '../src/events/report.event.js';

const ajv = new Ajv({ strict: false });
const validateReport = ajv.compile(thymianReportSchema);

describe('ThymianReport shared model', () => {
  // ---------------------------------------------------------------------------
  // Type-level construction tests
  // ---------------------------------------------------------------------------

  describe('ThymianReport construction', () => {
    it('should construct a minimal valid report with source and message only', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: '5 HTTP rules run successfully. 0 rules reported a violation.',
      };

      expect(report.source).toBe('@thymian/plugin-http-linter');
      expect(report.message).toBeDefined();
      expect(report.sections).toBeUndefined();
      expect(report.metadata).toBeUndefined();
    });

    it('should construct a report with sections containing rule-originated items', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: '3 HTTP rules run successfully. 1 rules reported a violation.',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              {
                severity: 'error',
                message: 'Missing Date header in response',
                ruleName: 'rfc9110/must-include-date-header',
              },
            ],
          },
        ],
      };

      expect(report.sections).toHaveLength(1);
      expect(report.sections![0]!.items[0]!.ruleName).toBe(
        'rfc9110/must-include-date-header',
      );
    });

    it('should construct a report with operational items that omit ruleName', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-tester',
        message: '[test-rule] 2 test cases skipped',
        sections: [
          {
            heading: 'Skipped test cases',
            items: [
              {
                severity: 'info',
                message: 'Test case A',
                details: 'No matching endpoint',
              },
              {
                severity: 'info',
                message: 'Test case B',
                details: 'Endpoint not reachable',
              },
            ],
          },
        ],
      };

      expect(report.sections![0]!.items[0]!.ruleName).toBeUndefined();
      expect(report.sections![0]!.items[0]!.severity).toBe('info');
    });

    it('should construct a report with full item attribution including details, links, and location', () => {
      const location: ThymianReportLocation = {
        file: {
          path: '/tmp/api.yaml',
          position: { line: 42, column: 1, offset: 1024 },
        },
        format: { elementType: 'node', elementId: 'node-1' },
      };

      const item: ThymianReportItem = {
        severity: 'warn',
        message: 'Deprecated endpoint pattern',
        ruleName: 'custom/no-deprecated-endpoints',
        details: 'The /v1/legacy endpoint uses a deprecated pattern.',
        links: [
          { title: 'Migration Guide', url: 'https://example.com/migrate' },
          { url: 'https://example.com/spec' },
        ],
        location,
      };

      expect(item.links).toHaveLength(2);
      expect(item.links![0]!.title).toBe('Migration Guide');
      expect(item.links![1]!.title).toBeUndefined();
      expect(item.location!.file!.path).toBe('/tmp/api.yaml');
      expect(item.location!.format!.elementType).toBe('node');
    });

    it('should support metadata on reports for context-specific information', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-tester',
        message: 'Test run complete',
        metadata: {
          validationMode: 'test',
          configSource: '/tmp/thymian.config.yaml',
          targetUrl: 'https://api.example.com',
        },
      };

      expect(report.metadata).toEqual({
        validationMode: 'test',
        configSource: '/tmp/thymian.config.yaml',
        targetUrl: 'https://api.example.com',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // ThymianReportSeverity coverage
  // ---------------------------------------------------------------------------

  describe('ThymianReportSeverity', () => {
    it.each(['error', 'warn', 'hint', 'info'] as ThymianReportSeverity[])(
      'should accept %s as a valid severity',
      (severity) => {
        const item: ThymianReportItem = {
          severity,
          message: `Item with ${severity} severity`,
        };

        expect(item.severity).toBe(severity);
      },
    );

    it('should map rule-originated severities (error, warn, hint) and reserve info for operational items', () => {
      // Rule pipeline produces error, warn, hint — never info
      const ruleOriginatedSeverities: ThymianReportSeverity[] = [
        'error',
        'warn',
        'hint',
      ];

      // info is only for direct-emission operational items
      const operationalSeverities: ThymianReportSeverity[] = ['info'];

      const allSeverities = [
        ...ruleOriginatedSeverities,
        ...operationalSeverities,
      ];

      expect(allSeverities).toEqual(['error', 'warn', 'hint', 'info']);
    });
  });

  // ---------------------------------------------------------------------------
  // ThymianReportLocation semantics for all three contexts
  // ---------------------------------------------------------------------------

  describe('ThymianReportLocation', () => {
    it('should represent lint context locations with file path and position', () => {
      const location: ThymianReportLocation = {
        file: {
          path: '/workspace/openapi.yaml',
          position: { line: 15, column: 3, offset: 200 },
        },
      };

      expect(location.file!.path).toBe('/workspace/openapi.yaml');
      expect(location.file!.position!.line).toBe(15);
      expect(location.format).toBeUndefined();
    });

    it('should represent test context locations with format graph elements', () => {
      const location: ThymianReportLocation = {
        format: {
          elementType: 'edge',
          elementId: 'tx-get-users-200',
        },
      };

      expect(location.format!.elementType).toBe('edge');
      expect(location.format!.elementId).toBe('tx-get-users-200');
      expect(location.file).toBeUndefined();
    });

    it('should represent analyze context locations with both file and format', () => {
      const location: ThymianReportLocation = {
        file: { uri: 'file:///traffic.har' },
        format: { elementType: 'node', elementId: 'req-1' },
      };

      expect(location.file!.uri).toBe('file:///traffic.har');
      expect(location.format!.elementType).toBe('node');
    });

    it('should support section-level location', () => {
      const section: ThymianReportSection = {
        heading: 'GET /users → 200 OK',
        items: [{ severity: 'error', message: 'Missing header' }],
        location: {
          format: { elementType: 'edge', elementId: 'tx-1' },
        },
      };

      expect(section.location!.format!.elementId).toBe('tx-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Clean-run representation
  // ---------------------------------------------------------------------------

  describe('clean-run representation', () => {
    it('should represent a clean lint run with no sections', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message:
          '10 HTTP rules run successfully. 0 rules reported a violation.',
      };

      expect(report.sections).toBeUndefined();
    });

    it('should represent a clean lint run with empty sections array', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message:
          '10 HTTP rules run successfully. 0 rules reported a violation.',
        sections: [],
      };

      expect(report.sections).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Schema validation tests
  // ---------------------------------------------------------------------------

  describe('thymianReportSchema (AJV validation)', () => {
    it('should validate a minimal report with source and message', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: 'All clear.',
      };

      const valid = validateReport(report);

      expect(valid).toBe(true);
      expect(validateReport.errors).toBeNull();
    });

    it('should validate a report with sections and rule-originated items', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-linter',
        message: 'Findings detected.',
        sections: [
          {
            heading: 'GET /users → 200 OK',
            items: [
              {
                severity: 'error',
                message: 'Missing Date header',
                ruleName: 'rfc9110/must-include-date-header',
                details: 'RFC 9110 Section 6.6.1 requires a Date header.',
                links: [
                  {
                    title: 'RFC 9110',
                    url: 'https://www.rfc-editor.org/rfc/rfc9110#section-6.6.1',
                  },
                ],
                location: {
                  file: {
                    path: '/tmp/api.yaml',
                    position: { line: 10, column: 1, offset: 100 },
                  },
                  format: { elementType: 'node', elementId: 'resp-1' },
                },
              },
            ],
            location: {
              format: { elementType: 'edge', elementId: 'tx-1' },
            },
          },
        ],
        metadata: { validationMode: 'lint' },
      };

      const valid = validateReport(report);

      expect(valid).toBe(true);
      expect(validateReport.errors).toBeNull();
    });

    it('should validate a report with items that omit ruleName (operational items)', () => {
      const report: ThymianReport = {
        source: '@thymian/plugin-http-tester',
        message: 'Skipped test cases.',
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

      const valid = validateReport(report);

      expect(valid).toBe(true);
      expect(validateReport.errors).toBeNull();
    });

    it('should reject a report missing the required source field', () => {
      const report = {
        message: 'Missing source.',
      };

      const valid = validateReport(report);

      expect(valid).toBe(false);
      expect(validateReport.errors).not.toBeNull();
    });

    it('should reject a report missing the required message field', () => {
      const report = {
        source: '@thymian/plugin-http-linter',
      };

      const valid = validateReport(report);

      expect(valid).toBe(false);
      expect(validateReport.errors).not.toBeNull();
    });

    it('should reject an item missing the required severity field', () => {
      const report = {
        source: '@thymian/plugin-http-linter',
        message: 'Bad item.',
        sections: [
          {
            heading: 'Bad',
            items: [{ message: 'Missing severity' }],
          },
        ],
      };

      const valid = validateReport(report);

      expect(valid).toBe(false);
    });

    it('should reject an item missing the required message field', () => {
      const report = {
        source: '@thymian/plugin-http-linter',
        message: 'Bad item.',
        sections: [
          {
            heading: 'Bad',
            items: [{ severity: 'error' }],
          },
        ],
      };

      const valid = validateReport(report);

      expect(valid).toBe(false);
    });

    it('should reject an invalid severity value', () => {
      const report = {
        source: '@thymian/plugin-http-linter',
        message: 'Bad severity.',
        sections: [
          {
            heading: 'Bad',
            items: [{ severity: 'critical', message: 'Invalid' }],
          },
        ],
      };

      const valid = validateReport(report);

      expect(valid).toBe(false);
    });

    it('should reject additional properties on the report', () => {
      const report = {
        source: '@thymian/plugin-http-linter',
        message: 'Extra field.',
        extraField: true,
      };

      const valid = validateReport(report);

      expect(valid).toBe(false);
    });

    it('should validate all four severity values', () => {
      for (const severity of ['error', 'warn', 'hint', 'info'] as const) {
        const report: ThymianReport = {
          source: 'test',
          message: 'test',
          sections: [
            {
              heading: 'test',
              items: [{ severity, message: `${severity} item` }],
            },
          ],
        };

        expect(validateReport(report)).toBe(true);
      }
    });

    it('should validate a report with metadata', () => {
      const report: ThymianReport = {
        source: 'test',
        message: 'test',
        metadata: { mode: 'lint', configPath: '/tmp/config.yaml' },
      };

      expect(validateReport(report)).toBe(true);
    });
  });
});
