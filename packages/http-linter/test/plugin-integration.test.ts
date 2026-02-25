import { join } from 'node:path';

import {
  DEFAULT_HEADER_SERIALIZATION_STYLE,
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

  it('rule should be able to disable rules', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['test'],
        rules: {
          'rfc9110/server-should-send-validator-fields': 'off',
        },
      })
      .ready();

    const format = createThymianFormatWithTransaction(
      createHttpRequest({
        method: 'get',
      }),
      createHttpResponse({
        statusCode: 200,
      }),
    );

    const rules = await thymian.emitter.emitAction(
      'http-linter.rules',
      undefined,
      {
        strategy: 'first',
      },
    );

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-static',
      { format: format.export() },
      { strategy: 'first' },
    );

    expect(result.valid).toBeTruthy();
    expect(rules).toHaveLength(0);
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

  it('should ignore given origins for specified rules', async () => {
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
        type: ['static'],
        rules: {
          'rfc9110/server-should-send-validator-fields': {
            skipOrigins: ['localhost:8080'],
          },
        },
      })
      .ready();

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
      { format: format.export() },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.reports).toHaveLength(1);
    expect(result.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          location: {
            format: { id, elementType: 'edge' },
          },
        }),
      ]),
    );
  });
});
