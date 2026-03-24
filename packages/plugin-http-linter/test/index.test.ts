import { join } from 'node:path';

import { Thymian, ThymianFormat } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import httpLinterPlugin from '../src/index.js';

describe('http-linter', { timeout: 10000 }, () => {
  it('http-linter.lint-static should return thymian reports', async () => {
    const thymian = new Thymian();
    await thymian
      .register(httpLinterPlugin, {
        ruleSets: [
          join(
            import.meta.dirname,
            'fixtures/rules/should-send-validator-fields.rule.mjs',
          ),
        ],
      })
      .ready();

    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get' }),
      createHttpResponse({ statusCode: 200 }),
    );

    const result = await thymian.emitter.emitAction(
      'http-linter.lint-static',
      {
        format: format.export(),
      },
      {
        strategy: 'first',
      },
    );

    expect(result.valid).toBeFalsy();
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.source).includes(
      'rfc9110/server-should-send-validator-fields',
    );

    await thymian.close();
  });
});
