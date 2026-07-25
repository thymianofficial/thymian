import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY_SERIALIZATION_STYLE } from '../../../src/constants.js';
import type { ThymianHttpRequest } from '../../../src/format/nodes/http-request.node.js';
import { validateExistingQueryParameter } from '../../../src/http-testing/validate/validate-request-query-parameters.js';

function requestWithQuerySchema(schema: unknown): ThymianHttpRequest {
  return {
    type: 'http-request',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    path: '/users',
    method: 'GET',
    headers: {},
    cookies: {},
    pathParameters: {},
    bodyRequired: false,
    body: {} as ThymianHttpRequest['body'],
    mediaType: '',
    label: '',
    sourceName: '',
    queryParameters: {
      page: {
        required: true,
        schema: schema as never,
        style: DEFAULT_QUERY_SERIALIZATION_STYLE,
      },
    },
  };
}

describe('validateExistingQueryParameter', () => {
  it('returns assertion-success for a query parameter matching its schema', () => {
    const request = requestWithQuerySchema({ type: 'string' });

    const results = validateExistingQueryParameter({ page: '12345' }, request);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: 'assertion-success',
      message: 'Valid query parameter "page".',
    });
  });

  it('emits one assertion-failure per schema error', () => {
    const request = requestWithQuerySchema({
      type: 'string',
      minLength: 5,
      pattern: '^[0-9]+$',
    });

    const results = validateExistingQueryParameter({ page: 'ab' }, request);

    const failures = results.filter((r) => r.type === 'assertion-failure');
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(
      failures.every((r) => r.message.startsWith('query parameter "page"')),
    ).toBe(true);
  });
});
