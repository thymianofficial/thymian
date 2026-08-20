import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY_SERIALIZATION_STYLE } from '../../../src/constants.js';
import type { ThymianHttpRequest } from '../../../src/format/nodes/http-request.node.js';
import type { SerializationStyle } from '../../../src/format/serialization-style/index.js';
import {
  parseQueryParameters,
  validateExistingQueryParameter,
  validateRequestQueryParameters,
} from '../../../src/http-testing/validate/validate-request-query-parameters.js';

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

function requestWithQueryParameters(
  queryParameters: ThymianHttpRequest['queryParameters'],
): ThymianHttpRequest {
  return {
    type: 'http-request',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    path: '/api/userreports',
    method: 'GET',
    headers: {},
    cookies: {},
    pathParameters: {},
    bodyRequired: false,
    body: {} as ThymianHttpRequest['body'],
    mediaType: '',
    label: '',
    sourceName: '',
    queryParameters,
  };
}

function queryStyle(
  style: SerializationStyle['style'],
  explode: boolean,
): SerializationStyle {
  return { style, explode };
}

describe('validateRequestQueryParameters — typed wire values (gh-624)', () => {
  const yearParameter = {
    required: true,
    schema: { type: 'integer', minimum: 1910, maximum: 2027 } as never,
    style: DEFAULT_QUERY_SERIALIZATION_STYLE,
  };

  it('accepts an integer parameter that arrived as a wire string', () => {
    const request = requestWithQueryParameters({ year: yearParameter });

    const results = validateRequestQueryParameters(
      '/api/userreports?year=2026',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-success',
        message: 'Valid query parameter "year".',
      }),
    );
  });

  it('still rejects a non-numeric value, reporting the actual string', () => {
    const request = requestWithQueryParameters({ year: yearParameter });

    const results = validateRequestQueryParameters(
      '/api/userreports?year=abc',
      request,
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-failure',
        message: 'query parameter "year" must be integer',
        actual: 'abc',
      }),
    );
  });

  it('still enforces numeric bounds after deserialization', () => {
    const request = requestWithQueryParameters({ year: yearParameter });

    const results = validateRequestQueryParameters(
      '/api/userreports?year=2100',
      request,
    );

    const failures = results.filter((r) => r.type === 'assertion-failure');
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toContain('query parameter "year"');
  });

  it('accepts a boolean/null union from its wire form', () => {
    const request = requestWithQueryParameters({
      enhanced_list: {
        required: false,
        schema: { type: ['boolean', 'null'] } as never,
        style: DEFAULT_QUERY_SERIALIZATION_STYLE,
      },
    });

    const results = validateRequestQueryParameters(
      '/api/userreports?enhanced_list=true',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it.each([
    ['?ids=1&ids=2', 'a repeated key'],
    ['?ids=1', 'a single occurrence'],
  ])('accepts an exploded array from %s (%s)', (query) => {
    const request = requestWithQueryParameters({
      ids: {
        required: false,
        schema: { type: 'array', items: { type: 'integer' } } as never,
        style: queryStyle('form', true),
      },
    });

    const results = validateRequestQueryParameters(
      `/api/userreports${query}`,
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it('reconstructs a deepObject parameter and reports neither missing nor additional', () => {
    const request = requestWithQueryParameters({
      filter: {
        required: true,
        schema: {
          type: 'object',
          properties: { customers_id: { type: 'integer' } },
        } as never,
        style: queryStyle('deepObject', true),
      },
    });

    const results = validateRequestQueryParameters(
      '/v2/entries?filter[customers_id]=4382930',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-success',
        message: 'Valid query parameter "filter".',
      }),
    );
  });

  it('reports an unsupported style as info, never as a failure', () => {
    const request = requestWithQueryParameters({
      ids: {
        required: false,
        schema: { type: 'array', items: { type: 'integer' } } as never,
        style: queryStyle('pipeDelimited', true),
      },
    });

    const results = validateRequestQueryParameters(
      '/api/userreports?ids=1|2',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);

    const info = results.filter((r) => r.type === 'info');
    expect(info).toHaveLength(1);
    expect(info[0]?.message).toContain('pipeDelimited');
  });
});

describe('parseQueryParameters — wire hygiene (gh-624)', () => {
  const opaque = {
    required: false,
    schema: { type: 'string' } as never,
    style: DEFAULT_QUERY_SERIALIZATION_STYLE,
  };

  it('keeps a value containing "=" intact', () => {
    const request = requestWithQueryParameters({ token: opaque });

    expect(parseQueryParameters('token=a=b', request)).toEqual({
      token: 'a=b',
    });
  });

  it('decodes "+" as a space', () => {
    const request = requestWithQueryParameters({ q: opaque });

    expect(parseQueryParameters('q=a+b', request)).toEqual({ q: 'a b' });
  });

  it('treats only the first "?" as the query delimiter', () => {
    const request = requestWithQueryParameters({ q: opaque });

    const results = validateRequestQueryParameters(
      '/api/userreports?q=what?now',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });
});

describe('validateRequestQueryParameters — review round 1 regressions', () => {
  const intParam = (
    style: SerializationStyle = DEFAULT_QUERY_SERIALIZATION_STYLE,
  ) => ({
    required: true,
    schema: { type: 'integer', maximum: 2027 } as never,
    style,
  });

  it('resolves a $ref parameter schema — the shape plugin-openapi emits', () => {
    const request = requestWithQueryParameters({
      year: {
        required: true,
        schema: {
          $ref: '#/$defs/Year',
          $defs: { Year: { type: 'integer', minimum: 1910, maximum: 2027 } },
        } as never,
        style: DEFAULT_QUERY_SERIALIZATION_STYLE,
      },
    });

    const results = validateRequestQueryParameters('/api?year=2026', request);

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it('keeps reporting a polluted scalar parameter', () => {
    const request = requestWithQueryParameters({ year: intParam() });

    const results = validateRequestQueryParameters(
      '/api?year=2026&year=9999',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).not.toEqual(
      [],
    );
  });

  it('does not throw on a prototype-named bracket key', () => {
    const request = requestWithQueryParameters({ year: intParam() });

    expect(() =>
      validateRequestQueryParameters(
        '/api?constructor[x]=1&year=2026',
        request,
      ),
    ).not.toThrow();
    expect(() =>
      validateRequestQueryParameters('/api?__proto__[x]=1&year=2026', request),
    ).not.toThrow();
  });

  it('reports a deepObject parameter that also arrived as a bare key', () => {
    const request = requestWithQueryParameters({
      filter: {
        required: true,
        schema: {
          type: 'object',
          properties: { id: { type: 'integer' } },
        } as never,
        style: queryStyle('deepObject', true),
      },
    });

    const results = validateRequestQueryParameters(
      '/v2/entries?filter=oops&filter[id]=1',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).not.toEqual(
      [],
    );
  });

  it('absorbs nested deepObject keys instead of calling them undocumented', () => {
    const request = requestWithQueryParameters({
      filter: {
        required: true,
        schema: {
          type: 'object',
          properties: { a: { type: 'string' } },
        } as never,
        style: queryStyle('deepObject', true),
      },
    });

    const results = validateRequestQueryParameters(
      '/v2/entries?filter[a][b]=1',
      request,
    );

    expect(
      results.filter((r) =>
        r.message.includes('is not included in the description format'),
      ),
    ).toEqual([]);
  });

  it('folds a form/explode:true object parameter from its bare property keys', () => {
    const request = requestWithQueryParameters({
      filter: {
        required: true,
        schema: {
          type: 'object',
          properties: { role: { type: 'string' }, level: { type: 'integer' } },
        } as never,
        style: queryStyle('form', true),
      },
    });

    const results = validateRequestQueryParameters(
      '/api?role=admin&level=3',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it('splits a non-exploded array before decoding', () => {
    const request = requestWithQueryParameters({
      ids: {
        required: false,
        schema: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 1,
        } as never,
        style: queryStyle('form', false),
      },
    });

    const results = validateRequestQueryParameters('/api?ids=a%2Cb', request);

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it('excludes a fragment from the query string', () => {
    const request = requestWithQueryParameters({ year: intParam() });

    const results = validateRequestQueryParameters(
      '/api?year=2026#section',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });

  it('skips an empty key rather than reporting it as undocumented', () => {
    const request = requestWithQueryParameters({ year: intParam() });

    const results = validateRequestQueryParameters(
      '/api?=value&year=2026',
      request,
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
  });
});
