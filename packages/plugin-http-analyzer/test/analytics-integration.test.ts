import { join } from 'node:path';

import {
  type CapturedTransaction,
  httpTransactionToLabel,
  Thymian,
  ThymianFormat,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import httpAnalyzerPlugin from '../src/index.js';

describe('http-analyzer analytics integration', { timeout: 30000 }, () => {
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
      .register(httpAnalyzerPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
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
        meta: {
          role: 'origin server',
        },
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
      .register(httpAnalyzerPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
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

  it('should return undefined for lint-analytics-batch when analyzer plugin is not registered', async () => {
    // In the split plugin architecture, the analyzer plugin is NOT registered,
    // so there is no handler for 'http-linter.lint-analytics-batch'.
    // emitAction returns undefined when no handler is registered.
    await thymian.ready();

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-analytics-batch',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result).toBeUndefined();
  });

  it('should handle large number of transactions', async () => {
    await thymian
      .register(httpAnalyzerPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
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
          meta: {
            role: 'origin server',
          },
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
      .register(httpAnalyzerPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
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
      .register(httpAnalyzerPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
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
              meta: {
                role: 'origin server',
              },
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
});
