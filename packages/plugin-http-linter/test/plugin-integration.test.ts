import { join } from 'node:path';

import {
  createRuleFilter,
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  loadRules,
  type RuleSeverity,
  Thymian,
  ThymianFormat,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import httpLinterPlugin from '../src/index.js';

describe('http-linter integration tests', () => {
  let thymian: Thymian;
  let format: ThymianFormat;

  beforeEach(async () => {
    thymian = new Thymian();
    format = new ThymianFormat();
  });

  afterEach(async () => {
    await thymian.close();
  });

  it('should provide options to rules', async () => {
    await thymian.register(httpLinterPlugin, {}).ready();

    const rulesConfig = {
      'rule-with-options': {
        options: {
          foo: 'lol',
        },
      },
    };

    const rules = await loadRules(
      join(import.meta.dirname, 'fixtures/rules/rule-with-options.rule.mjs'),
      undefined,
      rulesConfig,
    );

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
      { format: format.export(), rules, rulesConfig },
      { strategy: 'first' },
    );

    expect(result.valid).toBeFalsy();
  });

  it('should be able to disable a rule', async () => {
    await thymian.register(httpLinterPlugin, {}).ready();

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
      createHttpRequest({
        method: 'get',
      }),
      createHttpResponse({
        statusCode: 200,
      }),
    );

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-static',
      { format: format.export(), rules, rulesConfig },
      { strategy: 'first' },
    );

    expect(result.valid).toBeTruthy();
    // The rule is loaded with severity 'off' - loadRules applies the config
    // but doesn't filter. runRules skips rules with severity 'off' at runtime.
    expect(rules).toHaveLength(1);
    expect(rules[0].meta.severity).toBe('off');
  });

  it.each([
    ['off', 0],
    ['warn', 2],
    ['error', 1],
    ['hint', 2],
  ])(
    'should load rules respecting given severity %s and return %d rules',
    async (severity, length) => {
      await thymian.register(httpLinterPlugin, {}).ready();

      const ruleFilter = createRuleFilter({
        severity: severity as RuleSeverity,
        type: ['static'],
      });

      const rules = await loadRules(
        [
          join(import.meta.dirname, 'fixtures/rules/a.rule.mjs'),
          join(import.meta.dirname, 'fixtures/rules/b.rule.mjs'),
        ],
        ruleFilter,
      );

      expect(rules).toHaveLength(length);
    },
  );

  it('should ignore given origins for specified rules', async () => {
    await thymian.register(httpLinterPlugin, {}).ready();

    const rulesConfig = {
      'rfc9110/server-should-send-validator-fields': {
        skipOrigins: ['localhost:8080'],
      },
    };

    const rules = await loadRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
      undefined,
      rulesConfig,
    );

    format.addHttpTransaction(
      createHttpRequest({ host: 'localhost', port: 8080 }),
      createHttpResponse({ statusCode: 200 }),
      'test-source',
    );
    const [, , id] = format.addHttpTransaction(
      createHttpRequest({ host: 'localhost', port: 3000 }),
      createHttpResponse({ statusCode: 200 }),
      'test-source',
    );

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-static',
      { format: format.export(), rules, rulesConfig },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleName: 'rfc9110/server-should-send-validator-fields',
      severity: 'warn',
      violation: expect.objectContaining({
        location: expect.objectContaining({
          elementType: 'edge',
          elementId: id,
        }),
      }),
    });
  });
});

describe('core.lint integration tests', () => {
  let thymian: Thymian;

  beforeEach(async () => {
    thymian = new Thymian();
  });

  afterEach(async () => {
    await thymian.close();
  });

  it('should return ValidationResult shape with status and violations on failure', async () => {
    await thymian.register(httpLinterPlugin, {}).ready();

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
      'core.lint',
      { format: format.export(), rules },
      { strategy: 'first' },
    );

    expect(result.status).toBe('failed');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleName: 'rfc9110/server-should-send-validator-fields',
      severity: 'warn',
    });
  });

  it('should return status success and empty violations when all rules pass', async () => {
    await thymian.register(httpLinterPlugin, {}).ready();

    const rules = await loadRules(
      join(
        import.meta.dirname,
        'fixtures/rules/should-send-validator-fields.rule.mjs',
      ),
    );

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200, headers: { etag: '"abc"' } }),
    );

    const result = await thymian.emitter.emitAction(
      'core.lint',
      { format: format.export(), rules },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });

  it('should return status success with empty rules', async () => {
    await thymian.register(httpLinterPlugin, {}).ready();

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'core.lint',
      { format: format.export(), rules: [] },
      { strategy: 'first' },
    );

    expect(result.status).toBe('success');
    expect(result.violations).toHaveLength(0);
  });
});
