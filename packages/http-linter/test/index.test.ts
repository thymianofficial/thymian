import { Thymian, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import httpLinterPlugin from '../src/index.js';

describe('http-linter', { timeout: 10000 }, () => {
  it('http-linter.lint-static should return thymian reports', async () => {
    const thymian = new Thymian();
    await thymian
      .register(httpLinterPlugin, {
        rules: ['@thymian/rfc-9110-rules'],
        ruleFilter: {
          names: ['rfc9110/server-should-send-validator-fields'],
        },
      })
      .ready();

    const format = new ThymianFormat();

    format.addHttpTransaction(
      {
        cookies: {},
        headers: {},
        host: '',
        label: '',
        mediaType: '',
        method: 'get',
        path: '',
        pathParameters: {},
        port: 0,
        protocol: 'http',
        queryParameters: {},
        type: 'http-request',
      },
      {
        headers: {},
        mediaType: '',
        statusCode: 200,
        type: 'http-response',
      },
      'test',
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
