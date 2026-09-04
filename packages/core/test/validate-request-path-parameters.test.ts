import { describe, expect, it } from 'vitest';

import { DEFAULT_PATH_SERIALIZATION_STYLE } from '../src/constants.js';
import {
  checkForMissingPathParameters,
  validateExistingPathParameter,
  validateRequestPathParameters,
} from '../src/http-testing/validate/validate-request-path-parameters.js';
import type { ThymianHttpRequest } from '../src/index.js';

function createRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return {
    type: 'http-request',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    path: '/users/{userId}',
    method: 'GET',
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {
      userId: {
        required: true,
        schema: { type: 'string' },
        style: DEFAULT_PATH_SERIALIZATION_STYLE,
      },
    },
    bodyRequired: false,
    body: {},
    mediaType: '',
    label: '',
    sourceName: '',
    ...overrides,
  };
}

describe('validateRequestPathParameters', () => {
  describe('path matching', () => {
    it('should return assertion-failure when actual path does not match template', () => {
      const request = createRequest({ path: '/users/{userId}' });
      const results = validateRequestPathParameters('/orders/123', request);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: 'assertion-failure',
        message: expect.stringContaining('does not match the template path'),
      });
    });

    it('should match a simple path with one parameter', () => {
      const request = createRequest({ path: '/users/{userId}' });
      const results = validateRequestPathParameters('/users/42', request);

      const failures = results.filter((r) => r.type === 'assertion-failure');
      expect(failures).toHaveLength(0);
    });

    it('should match a path with multiple parameters', () => {
      const request = createRequest({
        path: '/users/{userId}/posts/{postId}',
        pathParameters: {
          userId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
          postId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });
      const results = validateRequestPathParameters(
        '/users/42/posts/99',
        request,
      );

      const failures = results.filter((r) => r.type === 'assertion-failure');
      expect(failures).toHaveLength(0);
    });

    it('should strip query string before matching', () => {
      const request = createRequest({ path: '/users/{userId}' });
      const results = validateRequestPathParameters(
        '/users/42?include=posts',
        request,
      );

      const failures = results.filter((r) => r.type === 'assertion-failure');
      expect(failures).toHaveLength(0);
    });
  });

  describe('checkForMissingPathParameters', () => {
    it('should report missing required path parameter', () => {
      const request = createRequest({
        path: '/users/{userId}/posts/{postId}',
        pathParameters: {
          userId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
          postId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      // Only userId is present in the extracted path params
      const results = checkForMissingPathParameters({ userId: '42' }, request);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: 'assertion-failure',
        message: expect.stringContaining('"postId" is required'),
      });
    });

    it('should not report missing optional path parameter', () => {
      const request = createRequest({
        pathParameters: {
          userId: {
            required: false,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      const results = checkForMissingPathParameters({}, request);

      expect(results).toHaveLength(0);
    });

    it('should not report when all required parameters are present', () => {
      const request = createRequest();
      const results = checkForMissingPathParameters({ userId: '42' }, request);

      expect(results).toHaveLength(0);
    });
  });

  describe('validateExistingPathParameter', () => {
    it('should return assertion-success for valid parameter matching schema', () => {
      const request = createRequest({
        pathParameters: {
          userId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      const results = validateExistingPathParameter({ userId: '42' }, request);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: 'assertion-success',
        message: expect.stringContaining('Valid path parameter "userId"'),
      });
    });

    it('should return assertion-failure for parameter not matching schema', () => {
      const request = createRequest({
        pathParameters: {
          userId: {
            required: true,
            schema: { type: 'integer' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      const results = validateExistingPathParameter(
        { userId: 'not-a-number' },
        request,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: 'assertion-failure',
        message: 'path parameter "userId" must be integer',
      });
    });

    it('should emit one assertion-failure per schema error', () => {
      const request = createRequest({
        pathParameters: {
          userId: {
            required: true,
            // A value can violate both constraints at once.
            schema: { type: 'string', minLength: 5, pattern: '^[0-9]+$' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      const results = validateExistingPathParameter({ userId: 'ab' }, request);

      const failures = results.filter((r) => r.type === 'assertion-failure');
      expect(failures.length).toBeGreaterThanOrEqual(2);
      expect(
        failures.every((r) => r.message.startsWith('path parameter "userId"')),
      ).toBe(true);
    });

    it('should return info when no schema is provided for parameter', () => {
      const request = createRequest({
        pathParameters: {
          userId: {
            required: true,
            schema: undefined as never,
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      const results = validateExistingPathParameter({ userId: '42' }, request);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: 'info',
        message: expect.stringContaining('No schema provided'),
      });
    });

    it('should skip parameters not defined in the request', () => {
      const request = createRequest({
        pathParameters: {},
      });

      const results = validateExistingPathParameter(
        { unknownParam: 'value' },
        request,
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('integration — validateRequestPathParameters', () => {
    it('should combine missing-parameter and schema-validation checks', () => {
      const request = createRequest({
        path: '/users/{userId}/posts/{postId}',
        pathParameters: {
          userId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
          postId: {
            required: true,
            schema: { type: 'string' },
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
      });

      const results = validateRequestPathParameters(
        '/users/42/posts/7',
        request,
      );

      // Both parameters matched and valid
      const successes = results.filter((r) => r.type === 'assertion-success');
      expect(successes).toHaveLength(2);
    });

    it('should return empty results when there are no path parameters', () => {
      const request = createRequest({
        path: '/health',
        pathParameters: {},
      });

      const results = validateRequestPathParameters('/health', request);

      expect(results).toHaveLength(0);
    });
  });
});

describe('validateRequestPathParameters — typed wire values (gh-624)', () => {
  function requestWithPathSchema(schema: unknown): ThymianHttpRequest {
    return createRequest({
      path: '/users/{userId}',
      pathParameters: {
        userId: {
          required: true,
          schema: schema as never,
          style: DEFAULT_PATH_SERIALIZATION_STYLE,
        },
      },
    });
  }

  it('accepts an integer path parameter that arrived as a wire string', () => {
    const results = validateRequestPathParameters(
      '/users/42',
      requestWithPathSchema({ type: 'integer', minimum: 1 }),
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-success',
        message: 'Valid path parameter "userId".',
      }),
    );
  });

  it('still rejects a non-numeric path parameter', () => {
    const results = validateRequestPathParameters(
      '/users/abc',
      requestWithPathSchema({ type: 'integer' }),
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-failure',
        message: 'path parameter "userId" must be integer',
        actual: 'abc',
      }),
    );
  });

  it('reports an unsupported path style as info, never as a failure', () => {
    // `label`/`matrix` are reversible now (gh-673); `deepObject` is not a path
    // style at all. A scalar needs no reconstruction and keeps its validation
    // (see the deserializer suite), so the unsupported path is only reachable
    // for structured values under a style that is not a path style.
    const request = createRequest({
      path: '/users/{userId}',
      pathParameters: {
        userId: {
          required: true,
          schema: { type: 'array', items: { type: 'integer' } } as never,
          style: { style: 'deepObject', explode: false },
        },
      },
    });

    const results = validateRequestPathParameters('/users/42', request);

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results).toContainEqual(expect.objectContaining({ type: 'info' }));
  });

  it('keeps an undecodable percent-escape encoded rather than dropping the segment', () => {
    // `match(..., { decode: false })` hands `extractPathParameters` the raw
    // segment so a delimiter inside an item survives splitting (see the
    // comment there). `decodePathComponent` then decodes it — except `%zz`
    // is not a valid escape, so `decodeURIComponent` throws and the raw,
    // still-percent-encoded text is what reaches the schema. Pin that: a
    // pattern matching the literal `%zz` passes, which only holds if the
    // escape was never decoded.
    const results = validateRequestPathParameters(
      '/users/%zz',
      requestWithPathSchema({ type: 'string', pattern: '^%zz$' }),
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-success',
        message: 'Valid path parameter "userId".',
      }),
    );
  });
});

describe('validateRequestPathParameters — label and matrix (gh-673)', () => {
  function requestWithStyledPath(
    schema: unknown,
    style: { style: string; explode: boolean },
  ): ThymianHttpRequest {
    return createRequest({
      path: '/users/{userId}',
      pathParameters: {
        userId: {
          required: true,
          schema: schema as never,
          style: style as never,
        },
      },
    });
  }

  it('validates a label path parameter instead of skipping it', () => {
    const results = validateRequestPathParameters(
      '/users/.42',
      requestWithStyledPath(
        { type: 'integer', minimum: 1 },
        { style: 'label', explode: false },
      ),
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results.filter((r) => r.type === 'info')).toEqual([]);
  });

  it('validates a matrix path parameter instead of skipping it', () => {
    const results = validateRequestPathParameters(
      '/users/;userId=42',
      requestWithStyledPath(
        { type: 'integer', minimum: 1 },
        { style: 'matrix', explode: false },
      ),
    );

    expect(results.filter((r) => r.type === 'assertion-failure')).toEqual([]);
    expect(results.filter((r) => r.type === 'info')).toEqual([]);
  });

  it('reports a matrix violation rather than an info (the gh-673 symptom)', () => {
    const results = validateRequestPathParameters(
      '/users/;userId=abcdef',
      requestWithStyledPath(
        { type: 'string', maxLength: 3 },
        { style: 'matrix', explode: false },
      ),
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        type: 'assertion-failure',
        message: 'path parameter "userId" must NOT have more than 3 characters',
      }),
    );
  });
});
