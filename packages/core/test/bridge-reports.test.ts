import { beforeEach, describe, expect, it } from 'vitest';

import type { ThymianReport } from '../src/events/report.event.js';
import {
  NoopLogger,
  Thymian,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianPluginFn,
} from '../src/index.js';

declare module '../src/events/index.js' {
  interface ThymianEvents {
    [event: string]: unknown;
  }
}

declare module '../src/actions/index.js' {
  interface ThymianActions {
    [action: string]: {
      event: unknown;
      response: unknown;
    };
  }
}

function createPluginFor(
  plugin: ThymianPluginFn<{ cwd: string }>,
): ThymianPlugin {
  return {
    name: '',
    version: '',
    plugin,
  };
}

describe('bridgeReports and createReportFromViolations', () => {
  let thymian: Thymian;

  beforeEach(() => {
    thymian = new Thymian(new NoopLogger());
  });

  it('should emit a core.report event with correct attribution when lint returns violations', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          const format = new ThymianFormat();
          format.addHttpTransaction(
            {
              type: 'http-request',
              host: 'localhost',
              port: 8080,
              protocol: 'http',
              path: '/users',
              method: 'get',
              headers: {},
              queryParameters: {},
              cookies: {},
              pathParameters: {},
              mediaType: '',
            },
            {
              type: 'http-response',
              headers: {},
              mediaType: 'application/json',
              statusCode: 200,
            },
            'spec-loader',
          );

          ctx.reply(format.export());
        });

        emitter.onAction('core.lint', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-http-linter',
            status: 'failed',
            violations: [
              {
                ruleName: 'rfc9110/must-include-date-header',
                severity: 'error',
                violation: {
                  location: 'GET /users → 200 OK',
                  message: 'Missing Date header in response',
                },
              },
              {
                ruleName: 'custom/response-must-have-content-type',
                severity: 'warn',
                violation: {
                  location: 'GET /users → 200 OK',
                  message: 'Content-Type header is missing',
                },
              },
            ],
            statistics: { rulesRun: 5, rulesWithViolations: 2 },
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    await thymian.ready();
    await thymian.lint({
      specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
    });

    expect(capturedReports).toHaveLength(1);

    const report = capturedReports[0]!;

    expect(report.source).toBe('@thymian/plugin-http-linter');

    expect(report.message).toContain('5 HTTP rules run successfully');
    expect(report.message).toContain('2 rules reported a violation');

    expect(report.sections).toHaveLength(1);
    expect(report.sections![0]!.heading).toBe('GET /users → 200 OK');

    const items = report.sections![0]!.items;
    expect(items).toHaveLength(2);

    expect(items[0]!.ruleName).toBe('rfc9110/must-include-date-header');
    expect(items[0]!.severity).toBe('error');
    expect(items[0]!.message).toBe('Missing Date header in response');

    expect(items[1]!.ruleName).toBe('custom/response-must-have-content-type');
    expect(items[1]!.severity).toBe('warn');
    expect(items[1]!.message).toBe('Content-Type header is missing');
  });

  it('should not emit core.report when there are no violations (clean run)', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          ctx.reply(new ThymianFormat().export());
        });

        emitter.onAction('core.lint', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-http-linter',
            status: 'success',
            violations: [],
            statistics: { rulesRun: 5, rulesWithViolations: 0 },
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    await thymian.ready();
    const result = await thymian.lint({
      specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
    });

    expect(capturedReports).toHaveLength(0);
    expect(result.classification).toBe('clean-run');
  });

  it('should emit core.report for test workflow violations', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          ctx.reply(new ThymianFormat().export());
        });

        emitter.onAction('core.test', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-http-tester',
            status: 'failed',
            violations: [
              {
                ruleName: 'test/response-status-ok',
                severity: 'hint',
                violation: {
                  location: 'test context',
                  message: 'Response returned 404 instead of 200',
                },
              },
            ],
            statistics: { rulesRun: 3, rulesWithViolations: 1 },
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    await thymian.ready();
    await thymian.test({
      specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
    });

    expect(capturedReports).toHaveLength(1);

    const report = capturedReports[0]!;
    expect(report.source).toBe('@thymian/plugin-http-tester');
    expect(report.sections![0]!.items[0]!.ruleName).toBe(
      'test/response-status-ok',
    );
    expect(report.sections![0]!.items[0]!.severity).toBe('hint');
  });

  it('should emit core.report for analyze workflow violations', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          ctx.reply(new ThymianFormat().export());
        });

        emitter.onAction('core.traffic.load', (_, ctx) => {
          ctx.reply({ transactions: [], traces: [], metadata: {} });
        });

        emitter.onAction('core.analyze', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-http-analyzer',
            status: 'failed',
            violations: [
              {
                ruleName: 'analyze/response-time-threshold',
                severity: 'warn',
                violation: {
                  location: 'traffic analysis',
                  message: 'Response time exceeds 500ms threshold',
                },
              },
            ],
            statistics: { rulesRun: 2, rulesWithViolations: 1 },
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    await thymian.ready();
    await thymian.analyze({
      traffic: [{ type: 'har', location: '/tmp/traffic.har' }],
    });

    expect(capturedReports).toHaveLength(1);

    const report = capturedReports[0]!;
    expect(report.source).toBe('@thymian/plugin-http-analyzer');
    expect(report.sections![0]!.items[0]!.ruleName).toBe(
      'analyze/response-time-threshold',
    );
    expect(report.sections![0]!.items[0]!.severity).toBe('warn');
  });

  it('should propagate metadata from ValidationResult to ThymianReport', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          ctx.reply(new ThymianFormat().export());
        });

        emitter.onAction('core.lint', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-http-linter',
            status: 'failed',
            violations: [
              {
                ruleName: 'test-rule',
                severity: 'error',
                violation: {
                  location: 'test location',
                  message: 'test message',
                },
              },
            ],
            metadata: {
              validationMode: 'lint',
              configSource: '/tmp/thymian.config.yaml',
            },
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    await thymian.ready();
    await thymian.lint({
      specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
    });

    expect(capturedReports).toHaveLength(1);
    expect(capturedReports[0]!.metadata).toEqual({
      validationMode: 'lint',
      configSource: '/tmp/thymian.config.yaml',
    });
  });

  it('should group violations into sections by resolved location heading', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          ctx.reply(new ThymianFormat().export());
        });

        emitter.onAction('core.lint', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-http-linter',
            status: 'failed',
            violations: [
              {
                ruleName: 'rule-a',
                severity: 'error',
                violation: { location: 'Section A', message: 'Error in A' },
              },
              {
                ruleName: 'rule-b',
                severity: 'warn',
                violation: { location: 'Section B', message: 'Warning in B' },
              },
              {
                ruleName: 'rule-c',
                severity: 'hint',
                violation: { location: 'Section A', message: 'Hint in A' },
              },
            ],
            statistics: { rulesRun: 3, rulesWithViolations: 3 },
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    await thymian.ready();
    await thymian.lint({
      specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
    });

    const report = capturedReports[0]!;

    // Two distinct headings should produce two sections
    expect(report.sections).toHaveLength(2);

    const sectionA = report.sections!.find((s) => s.heading === 'Section A');
    const sectionB = report.sections!.find((s) => s.heading === 'Section B');

    expect(sectionA).toBeDefined();
    expect(sectionA!.items).toHaveLength(2);
    expect(sectionA!.items[0]!.ruleName).toBe('rule-a');
    expect(sectionA!.items[1]!.ruleName).toBe('rule-c');

    expect(sectionB).toBeDefined();
    expect(sectionB!.items).toHaveLength(1);
    expect(sectionB!.items[0]!.ruleName).toBe('rule-b');
  });

  it('should handle multiple ValidationResults from different plugins', async () => {
    const capturedReports: ThymianReport[] = [];

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.format.load', (_, ctx) => {
          ctx.reply(new ThymianFormat().export());
        });

        emitter.onAction('core.lint', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-a',
            status: 'failed',
            violations: [
              {
                ruleName: 'rule-from-a',
                severity: 'error',
                violation: { location: 'loc-a', message: 'Error from A' },
              },
            ],
          });
        });

        emitter.on('core.report', (report: unknown) => {
          capturedReports.push(report as ThymianReport);
        });

        emitter.onAction('core.report.flush', (_, ctx) => {
          ctx.reply({ text: '' });
        });
      }),
    );

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.lint', (_, ctx) => {
          ctx.reply({
            source: '@thymian/plugin-b',
            status: 'failed',
            violations: [
              {
                ruleName: 'rule-from-b',
                severity: 'warn',
                violation: { location: 'loc-b', message: 'Warning from B' },
              },
            ],
          });
        });
      }),
    );

    await thymian.ready();
    await thymian.lint({
      specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
    });

    // Each ValidationResult with violations produces one ThymianReport
    expect(capturedReports).toHaveLength(2);
    expect(capturedReports[0]!.source).toBe('@thymian/plugin-a');
    expect(capturedReports[1]!.source).toBe('@thymian/plugin-b');
  });
});
