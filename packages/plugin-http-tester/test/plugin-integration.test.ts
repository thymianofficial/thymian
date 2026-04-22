import { join } from 'node:path';

import type { Rule, TestContext } from '@thymian/core';
import {
  loadRules,
  method,
  singleTestCase,
  statusCode,
  Thymian,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import httpTesterPlugin from '../src/index.js';

/**
 * Register mock plugins for core.request.sample, core.request.dispatch,
 * and http-testing hooks so the tester's httpTest pipeline can operate.
 */
function registerRequestMocks(
  thymian: Thymian,
  dispatchHeaders: Record<string, string> = {
    'content-type': 'application/json',
  },
) {
  thymian.register(
    {
      name: '@thymian/mock-sampler',
      version: '0.x',
      actions: { listensOn: ['core.request.sample'] },
      async plugin(emitter) {
        emitter.onAction(
          'core.request.sample',
          async ({ transaction }, ctx) => {
            ctx.reply({
              method: transaction.thymianReq.method,
              origin: `http://${transaction.thymianReq.host ?? 'localhost'}:${transaction.thymianReq.port ?? 80}`,
              path: transaction.thymianReq.path,
              headers: {},
              pathParameters: {},
              query: {},
              authorize: false,
              cookies: {},
            });
          },
        );
      },
    },
    {},
  );

  thymian.register(
    {
      name: '@thymian/mock-dispatcher',
      version: '0.x',
      actions: { listensOn: ['core.request.dispatch'] },
      async plugin(emitter) {
        emitter.onAction('core.request.dispatch', async (_, ctx) => {
          ctx.reply({
            statusCode: 200,
            duration: 10,
            trailers: {},
            headers: dispatchHeaders,
          });
        });
      },
    },
    {},
  );

  // The tester pipeline emits http-testing.beforeRequest / afterResponse hooks.
  // Without handlers, emitAction returns undefined and the hook runner crashes.
  thymian.register(
    {
      name: '@thymian/mock-hooks',
      version: '0.x',
      actions: {
        listensOn: [
          'http-testing.beforeRequest',
          'http-testing.afterResponse',
          'http-testing.authorize',
        ],
      },
      async plugin(emitter) {
        emitter.onAction('http-testing.beforeRequest', async (payload, ctx) => {
          ctx.reply({ result: payload.value });
        });
        emitter.onAction('http-testing.afterResponse', async (payload, ctx) => {
          ctx.reply({ result: payload.value });
        });
        emitter.onAction('http-testing.authorize', async (payload, ctx) => {
          ctx.reply({ result: payload.value });
        });
      },
    },
    {},
  );
}

describe('core.test integration tests', { timeout: 30000 }, () => {
  let thymian: Thymian;

  beforeEach(async () => {
    thymian = new Thymian();
  });

  afterEach(async () => {
    await thymian.close();
  });

  it('should return ValidationResult shape with status and violations on failure', async () => {
    registerRequestMocks(thymian);
    await thymian.register(httpTesterPlugin, {}).ready();

    const rules = await loadRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'core.test',
      { format: format.export(), rules },
      { strategy: 'first' },
    );

    expect(result.status).toBe('failed');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0]).toMatchObject({
      ruleName: 'rfc9110/server-should-send-validator-fields',
      severity: 'warn',
    });
  });

  it('should return status success when dispatched responses satisfy rules', async () => {
    // Return a response WITH validator fields — rule should pass
    registerRequestMocks(thymian, {
      'content-type': 'application/json',
      etag: '"abc123"',
    });
    await thymian.register(httpTesterPlugin, {}).ready();

    const rules = await loadRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'core.test',
      { format: format.export(), rules },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should return status success with empty rules', async () => {
    await thymian.register(httpTesterPlugin, {}).ready();

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'core.test',
      { format: format.export(), rules: [] },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should skip rules with severity off via rulesConfig', async () => {
    registerRequestMocks(thymian);
    await thymian.register(httpTesterPlugin, {}).ready();

    const rulesConfig = {
      'rfc9110/server-should-send-validator-fields': 'off' as const,
    };

    const rules = await loadRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
      undefined,
      rulesConfig,
    );

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'core.test',
      { format: format.export(), rules, rulesConfig },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should emit a single aggregated core.report for skipped test cases', async () => {
    registerRequestMocks(thymian);
    await thymian.register(httpTesterPlugin, {}).ready();

    const reports: unknown[] = [];
    thymian.emitter.on('core.report', (report) => {
      reports.push(report);
    });

    const rules: Rule[] = [
      {
        meta: {
          name: 'custom/skip-report',
          type: ['test'],
          options: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          severity: 'warn' as const,
        },
        testRule: (ctx: TestContext) =>
          ctx.httpTest(
            singleTestCase()
              .forTransactionsWith(method('get'))
              .run()
              .skipIf(statusCode(200), 'Skip because status is 200')
              .done(),
          ),
      },
    ];

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'core.test',
      { format: format.export(), rules },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
    expect(result.metadata?.diagnosticsByRule).toEqual({
      'custom/skip-report': {
        skippedCases: [
          {
            name: expect.any(String),
            reason: 'Skip because status is 200',
          },
        ],
        failedCases: [],
      },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      source: '@thymian/plugin-http-tester',
      message: 'HTTP test execution summary: 1 skipped, 0 failed test case(s).',
      sections: expect.arrayContaining([
        expect.objectContaining({
          heading: 'Overview',
        }),
        expect.objectContaining({
          heading: 'Skipped by reason',
          items: [
            expect.objectContaining({
              message: 'Skip because status is 200',
              details: '1 test case(s)',
            }),
          ],
        }),
        expect.objectContaining({
          heading: 'Skipped test cases',
        }),
      ]),
    });
  });
});
