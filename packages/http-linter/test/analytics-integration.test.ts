import { join } from 'node:path';

import {
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  httpTransactionToLabel,
  Thymian,
  ThymianFormat,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import httpLinterPlugin, { type RuleSeverity } from '../src/index.js';
import type { CapturedTransaction } from '../src/types.js';

describe('http-linter analytics integration', { timeout: 30000 }, () => {
  let thymian: Thymian;
  let format: ThymianFormat;

  beforeEach(async () => {
    thymian = new Thymian();
    format = new ThymianFormat();
  });

  afterEach(async () => {
    await thymian.close();
  });

  it('should register plugin, receive transactions via event, and lint via action', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['analytics'],
        analytics: {
          captureTransactions: {
            type: 'in-memory',
          },
        },
      })
      .ready();

    const transaction: CapturedTransaction = {
      request: {
        data: {
          method: 'get',
          origin: 'https://api.example.com',
          path: '/users/123',
          headers: {},
        },
        meta: {},
      },
      response: {
        data: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
          },
          trailers: {},
          duration: 0,
        },
        meta: {},
      },
    };

    thymian.emitter.emit('http-linter.transaction', transaction);

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-analytics-batch',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({
      source: 'rfc9110/server-should-send-validator-fields',
      title: httpTransactionToLabel(
        transaction.request.data,
        transaction.response.data,
      ),
    });
  });

  it('should return valid when all transactions pass rules', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['analytics'],
        analytics: {
          captureTransactions: {
            type: 'in-memory',
          },
        },
      })
      .ready();

    thymian.emitter.emit('http-linter.transaction', {
      request: {
        data: {
          method: 'get',
          origin: 'https://api.example.com',
          path: '/users/123',
          headers: {},
        },
        meta: {},
      },
      response: {
        data: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            etag: '"abc123"',
          },
          trailers: {},
          duration: 0,
        },
        meta: {},
      },
    });

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-analytics-batch',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBe(true);
    expect(result.reports).toHaveLength(0);
  });

  it('should handle lint-analytics action without analytics mode enabled', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['static'], // analytics is NOT enabled
      })
      .ready();

    await expect(
      thymian.emitter.emitAction(
        'http-linter.lint-analytics-batch',
        {
          format: format.export(),
        },
        {
          strategy: 'first',
        },
      ),
    ).rejects.toThrow();
  });

  it('should handle large number of transactions', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['analytics'],
        analytics: {
          captureTransactions: {
            type: 'in-memory',
          },
        },
      })
      .ready();

    for (let i = 0; i < 100; i++) {
      thymian.emitter.emit('http-linter.transaction', {
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: `/resource/${i}`,
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            duration: 0,
            trailers: {},
            headers: {
              'content-type': 'application/json',
              ...(i % 10 === 0 ? { etag: `"etag-${i}"` } : {}),
            },
          },
          meta: {},
        },
      });
    }

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-analytics-batch',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.reports).toHaveLength(90);
  });

  it('should handle interleaved transaction events and multiple lints', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['analytics'],
        analytics: {
          captureTransactions: {
            type: 'in-memory',
          },
        },
      })
      .ready();

    thymian.emitter.emit('http-linter.transaction', {
      request: {
        data: {
          method: 'get',
          origin: 'https://api.example.com',
          path: '/users/123',
          headers: {},
        },
        meta: {},
      },
      response: {
        data: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            etag: '"abc123"',
          },
          trailers: {},
          duration: 0,
        },
        meta: {},
      },
    });

    const result1 = await thymian.emitter.emitAction(
      'http-linter.lint-analytics',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    const firstCount = result1.reports.length;
    expect(firstCount).toBeGreaterThanOrEqual(0);

    thymian.emitter.emit('http-linter.transaction', {
      request: {
        data: {
          method: 'get',
          origin: 'https://api.example.com',
          path: '/users/123',
          headers: {},
        },
        meta: {},
      },
      response: {
        data: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            etag: '"abc123"',
          },
          trailers: {},
          duration: 0,
        },
        meta: {},
      },
    });

    const result2 = await thymian.emitter.emitAction(
      'http-linter.lint-analytics',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result2.reports.length).toBeGreaterThanOrEqual(firstCount);
  });

  it('should handle concurrent transaction insertions', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['analytics'],
        analytics: {
          captureTransactions: {
            type: 'in-memory',
          },
        },
      })
      .ready();

    const emitPromises = [];
    for (let i = 0; i < 50; i++) {
      emitPromises.push(
        (async () => {
          thymian.emitter.emit('http-linter.transaction', {
            request: {
              data: {
                method: 'get',
                origin: 'https://api.example.com',
                path: `/concurrent/${i}`,
                headers: {},
              },
              meta: {},
            },
            response: {
              data: {
                statusCode: 200,
                headers: {},
                duration: 0,
                trailers: {},
              },
              meta: {},
            },
          });
        })(),
      );
    }

    await Promise.all(emitPromises);

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-analytics-batch',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.reports).toHaveLength(50);
  });

  it('should provide options to rules', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/rule-with-options.rule.mjs',
          ),
        ],
        type: ['static'],
        rules: {
          'rule-with-options': {
            options: {
              foo: 'lol',
            },
          },
        },
      })
      .ready();

    const format = createThymianFormatWithTransaction(
      createHttpRequest({
        headers: {
          lol: {
            required: false,
            schema: {
              type: 'string',
            },
            style: DEFAULT_HEADER_SERIALIZATION_STYLE,
          },
        },
      }),
      createHttpResponse(),
    );

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-static',
      { format: format.export() },
      { strategy: 'first' },
    );

    expect(result.valid).toBeFalsy();
  });

  it.each([
    ['off', 0],
    ['warn', 2],
    ['error', 1],
    ['hint', 2],
  ])(
    'should load rules respecting given severity %s and return %d rules',
    async (severity, length) => {
      await thymian
        .register(httpLinterPlugin, {
          ruleSets: [
            join(import.meta.dirname, 'fixtures/rules/a.rule.mjs'),
            join(import.meta.dirname, 'fixtures/rules/b.rule.mjs'),
          ],
          severity: severity as RuleSeverity,
          type: ['test'],
        })
        .ready();

      const result = await thymian.emitter.emitAction(
        'http-linter.rules',
        undefined,
        { strategy: 'first' },
      );

      expect(result).toHaveLength(length);
    },
  );
});
