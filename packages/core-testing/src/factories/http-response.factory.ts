import type { ThymianHttpResponse } from '@thymian/core';

/**
 * Creates a ThymianHttpResponse with sensible defaults.
 * All properties can be overridden.
 *
 * @param overrides - Partial response to override defaults
 * @returns A complete ThymianHttpResponse object
 *
 * @example
 * ```typescript
 * const okResponse = createHttpResponse({ statusCode: 200 });
 * const errorResponse = createHttpResponse({
 *   statusCode: 404,
 *   description: 'Not Found'
 * });
 * ```
 */
export function createHttpResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  const statusCode = overrides.statusCode || 200;
  return {
    type: 'http-response',
    label: overrides.label || `Response ${statusCode}`,
    statusCode,
    headers: {},
    mediaType: 'application/json',
    sourceName: 'test-source',
    ...overrides,
  };
}

/**
 * Creates a 200 OK response
 */
export function createOkResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 200,
    description: 'OK',
    ...overrides,
  });
}

/**
 * Creates a 201 Created response
 */
export function createCreatedResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 201,
    description: 'Created',
    ...overrides,
  });
}

/**
 * Creates a 204 No Content response
 */
export function createNoContentResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 204,
    description: 'No Content',
    mediaType: '',
    ...overrides,
  });
}

/**
 * Creates a 400 Bad Request response
 */
export function createBadRequestResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 400,
    description: 'Bad Request',
    ...overrides,
  });
}

/**
 * Creates a 401 Unauthorized response
 */
export function createUnauthorizedResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 401,
    description: 'Unauthorized',
    ...overrides,
  });
}

/**
 * Creates a 403 Forbidden response
 */
export function createForbiddenResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 403,
    description: 'Forbidden',
    ...overrides,
  });
}

/**
 * Creates a 404 Not Found response
 */
export function createNotFoundResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 404,
    description: 'Not Found',
    ...overrides,
  });
}

/**
 * Creates a 500 Internal Server Error response
 */
export function createInternalServerErrorResponse(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return createHttpResponse({
    statusCode: 500,
    description: 'Internal Server Error',
    ...overrides,
  });
}
