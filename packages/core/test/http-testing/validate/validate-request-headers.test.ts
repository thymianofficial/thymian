import { describe, expect, it } from 'vitest';

import { DEFAULT_HEADER_SERIALIZATION_STYLE } from '../../../src/constants.js';
import type { ThymianHttpRequest } from '../../../src/format/nodes/http-request.node.js';
import { validateExistingRequestHeader } from '../../../src/http-testing/validate/validate-request-headers.js';

function requestWithHeaderSchema(schema: unknown): ThymianHttpRequest {
  return {
    type: 'http-request',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    path: '/users',
    method: 'GET',
    queryParameters: {},
    cookies: {},
    pathParameters: {},
    bodyRequired: false,
    body: {} as ThymianHttpRequest['body'],
    mediaType: '',
    label: '',
    sourceName: '',
    headers: {
      'x-count': {
        required: true,
        schema: schema as never,
        style: DEFAULT_HEADER_SERIALIZATION_STYLE,
      },
    },
  };
}

describe('validateExistingRequestHeader', () => {
  it('returns assertion-success for a request header matching its schema', () => {
    const request = requestWithHeaderSchema({ type: 'string' });

    const results = validateExistingRequestHeader(
      { 'x-count': '12345' },
      request,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: 'assertion-success',
      message: 'Valid request header x-count.',
    });
  });

  it('emits one assertion-failure per schema error', () => {
    const request = requestWithHeaderSchema({
      type: 'string',
      minLength: 5,
      pattern: '^[0-9]+$',
    });

    const results = validateExistingRequestHeader({ 'x-count': 'ab' }, request);

    const failures = results.filter((r) => r.type === 'assertion-failure');
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(
      failures.every((r) => r.message.startsWith('request header "x-count"')),
    ).toBe(true);
  });
});

describe('validateExistingRequestHeader — typed wire values (gh-624)', () => {
  it('accepts an integer header that arrived as a wire string', () => {
    const request = requestWithHeaderSchema({ type: 'integer', minimum: 0 });

    const results = validateExistingRequestHeader({ 'x-count': '5' }, request);

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it('still rejects a non-numeric header value', () => {
    const request = requestWithHeaderSchema({ type: 'integer' });

    const results = validateExistingRequestHeader({ 'x-count': 'ab' }, request);

    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-failure',
        actual: 'ab',
      }),
    );
  });
});
