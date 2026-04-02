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
        message: expect.stringContaining('Invalid value for path parameter'),
      });
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
