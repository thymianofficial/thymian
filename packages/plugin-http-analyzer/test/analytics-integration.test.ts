import { join } from 'node:path';

import {
  type CapturedTransaction,
  createRuleFilter,
  httpTransactionToLabel,
  loadRules,
  Thymian,
  ThymianFormat,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import httpAnalyzerPlugin from '../src/index.js';

async function loadAnalyzerRules(fixturePath: string) {
  const ruleFilter = createRuleFilter({
    severity: 'hint',
    type: ['analytics'],
  });
  return loadRules(fixturePath, ruleFilter);
}

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
        storage: { type: 'memory' },
      })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

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

    thymian.emitter.emit('http-analyzer.transaction', transaction);

    const result = await thymian.emitter.emitAction(
      'http-analyzer.lint-analytics-batch',
      {
        format: format.export(),
        rules,
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleName: 'rfc9110/server-should-send-validator-fields',
      severity: 'warn',
    });
    // The transaction heading should appear in the violation location
    const expectedHeading = httpTransactionToLabel(
      transaction.request.data,
      transaction.response.data,
    );
    expect(result.violations[0].violation.location).toBe(expectedHeading);
  });

  it('should return valid when all transactions pass rules', async () => {
    await thymian
      .register(httpAnalyzerPlugin, {
        storage: { type: 'memory' },
      })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    thymian.emitter.emit('http-analyzer.transaction', {
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
      'http-analyzer.lint-analytics-batch',
      {
        format: format.export(),
        rules,
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBe(true);
  });

  it('should return undefined for lint-analytics-batch when analyzer plugin is not registered', async () => {
    // In the split plugin architecture, the analyzer plugin is NOT registered,
    // so there is no handler for 'http-analyzer.lint-analytics-batch'.
    // emitAction returns undefined when no handler is registered.
    await thymian.ready();

    const result = await thymian.emitter.emitAction(
      'http-analyzer.lint-analytics-batch',
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
        storage: { type: 'memory' },
      })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    for (let i = 0; i < 100; i++) {
      thymian.emitter.emit('http-analyzer.transaction', {
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
      'http-analyzer.lint-analytics-batch',
      {
        format: format.export(),
        rules,
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    // All violations for the same rule — 90 transactions without etag produce 90 violations
    expect(result.violations).toHaveLength(90);
  });

  it('should handle interleaved transaction events and multiple lints', async () => {
    await thymian
      .register(httpAnalyzerPlugin, {
        storage: { type: 'memory' },
      })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    thymian.emitter.emit('http-analyzer.transaction', {
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
      'http-analyzer.lint-analytics',
      {
        format: format.export(),
        rules,
      },
      {
        strategy: 'first',
      },
    );

    const firstCount = result1.violations.length;
    expect(firstCount).toBeGreaterThanOrEqual(0);

    thymian.emitter.emit('http-analyzer.transaction', {
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
      'http-analyzer.lint-analytics',
      {
        format: format.export(),
        rules,
      },
      {
        strategy: 'first',
      },
    );

    expect(result2.violations.length).toBeGreaterThanOrEqual(firstCount);
  });

  it('should handle concurrent transaction insertions', async () => {
    await thymian
      .register(httpAnalyzerPlugin, {
        storage: { type: 'memory' },
      })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const emitPromises = [];
    for (let i = 0; i < 50; i++) {
      emitPromises.push(
        (async () => {
          thymian.emitter.emit('http-analyzer.transaction', {
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
      'http-analyzer.lint-analytics-batch',
      {
        format: format.export(),
        rules,
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    // All violations for the same rule — 50 transactions produce 50 violations
    expect(result.violations).toHaveLength(50);
  });
});

describe('core.analyze integration tests', { timeout: 30000 }, () => {
  let thymian: Thymian;

  beforeEach(async () => {
    thymian = new Thymian();
  });

  afterEach(async () => {
    await thymian.close();
  });

  function createFailingTransaction(): CapturedTransaction {
    return {
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
          headers: { 'content-type': 'application/json' },
          trailers: {},
          duration: 0,
        },
        meta: { role: 'origin server' },
      },
    };
  }

  function createPassingTransaction(): CapturedTransaction {
    return {
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
        meta: { role: 'origin server' },
      },
    };
  }

  it('should return ValidationResult shape with status and violations on failure', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const result = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: { transactions: [createFailingTransaction()] },
      },
      { strategy: 'first' },
    );

    expect(result.status).toBe('failed');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0]).toMatchObject({
      ruleName: 'rfc9110/server-should-send-validator-fields',
      severity: 'warn',
    });
  });

  it('should return status success when all transactions pass rules', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const result = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: { transactions: [createPassingTransaction()] },
      },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should return status success with empty rules', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const result = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules: [],
        traffic: { transactions: [createFailingTransaction()] },
      },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should use ephemeral repo independent from persistent event-fed repo', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    // Feed a failing transaction into the persistent repo via events
    thymian.emitter.emit(
      'http-analyzer.transaction',
      createFailingTransaction(),
    );

    // Call core.analyze with only a passing transaction
    const result = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: { transactions: [createPassingTransaction()] },
      },
      { strategy: 'first' },
    );

    // The failing transaction in the persistent repo should NOT affect core.analyze
    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);

    // Verify the persistent repo still has the failing transaction via batch action
    const batchResult = await thymian.emitter.emitAction(
      'http-analyzer.lint-analytics-batch',
      { format: new ThymianFormat().export(), rules },
      { strategy: 'first' },
    );

    expect(batchResult.valid).toBeFalsy();
    expect(batchResult.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should isolate consecutive core.analyze calls (no state bleed)', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    // First analyze: failing transaction → violations
    const result1 = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: { transactions: [createFailingTransaction()] },
      },
      { strategy: 'first' },
    );

    expect(result1.status).toBe('failed');
    expect(result1.violations.length).toBeGreaterThanOrEqual(1);

    // Second analyze: passing transaction → no violations
    // The failing transaction from the first call must NOT persist
    const result2 = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: { transactions: [createPassingTransaction()] },
      },
      { strategy: 'first' },
    );

    expect(result2.status).toBe('success');
    expect(result2.violations).toHaveLength(0);
  });

  it('should produce deterministic results for identical input', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const traffic = {
      transactions: [
        createFailingTransaction(),
        createPassingTransaction(),
        createFailingTransaction(),
      ],
    };

    const result1 = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic,
      },
      { strategy: 'first' },
    );

    const result2 = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic,
      },
      { strategy: 'first' },
    );

    expect(result1.status).toBe(result2.status);
    expect(result1.violations).toHaveLength(result2.violations.length);
    expect(result1.violations.map((v) => v.ruleName)).toEqual(
      result2.violations.map((v) => v.ruleName),
    );
  });

  it('should handle empty traffic gracefully (no transactions, no traces)', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const result = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: {},
      },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should filter transactions by response role for analytics rules', async () => {
    await thymian
      .register(httpAnalyzerPlugin, { storage: { type: 'memory' } })
      .ready();

    const rules = await loadAnalyzerRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    // A transaction with a 'proxy' role on the response — the rule targets
    // 'origin server' so the proxy transaction should be filtered out and
    // produce zero violations.
    const proxyTransaction: CapturedTransaction = {
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
          headers: { 'content-type': 'application/json' },
          trailers: {},
          duration: 0,
        },
        meta: { role: 'proxy' },
      },
    };

    const result = await thymian.emitter.emitAction(
      'core.analyze',
      {
        format: new ThymianFormat().export(),
        rules,
        traffic: { transactions: [proxyTransaction] },
      },
      { strategy: 'first' },
    );

    // Proxy role is not 'origin server', so the transaction is excluded
    expect(result.violations).toHaveLength(0);
    expect(result.status).toBe('success');
  });
});
