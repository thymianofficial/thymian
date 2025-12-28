import type { ThymianHttpRequest } from '@thymian/core';

/**
 * Creates a ThymianHttpRequest with sensible defaults.
 * All properties can be overridden.
 *
 * @param overrides - Partial request to override defaults
 * @returns A complete ThymianHttpRequest object
 *
 * @example
 * ```typescript
 * const getRequest = createHttpRequest({ method: 'GET', path: '/users' });
 * const postRequest = createHttpRequest({
 *   method: 'POST',
 *   path: '/users',
 *   body: createObjectSchema()
 * });
 * ```
 */
export function createHttpRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return {
    type: 'http-request',
    label:
      overrides.label ||
      `${overrides.method || 'GET'} ${overrides.path || '/'}`,
    host: 'localhost',
    port: 443,
    protocol: 'https',
    path: '/',
    method: 'GET',
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {},
    mediaType: '',
    ...overrides,
  };
}

/**
 * Creates a GET request
 */
export function createGetRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return createHttpRequest({
    method: 'GET',
    ...overrides,
  });
}

/**
 * Creates a POST request
 */
export function createPostRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return createHttpRequest({
    method: 'POST',
    mediaType: 'application/json',
    ...overrides,
  });
}

/**
 * Creates a PUT request
 */
export function createPutRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return createHttpRequest({
    method: 'PUT',
    mediaType: 'application/json',
    ...overrides,
  });
}

/**
 * Creates a PATCH request
 */
export function createPatchRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return createHttpRequest({
    method: 'PATCH',
    mediaType: 'application/json',
    ...overrides,
  });
}

/**
 * Creates a DELETE request
 */
export function createDeleteRequest(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return createHttpRequest({
    method: 'DELETE',
    ...overrides,
  });
}
