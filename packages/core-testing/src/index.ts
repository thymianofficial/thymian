/**
 * @thymian/core-testing
 *
 * Testing utilities, factories, and mocks for the Thymian plugin ecosystem.
 *
 * This entry point holds what runs in any test framework and does not load
 * `vitest`. The parts built on vitest have their own entry points, which need
 * `vitest` installed:
 *
 * - `@thymian/core-testing/mocks`: test doubles built on `vi.fn()`
 * - `@thymian/core-testing/scenarios`: `describeRuleContextScenarios`, the
 *   rule-context scenario suite each validation engine runs
 *
 * @example
 * ```typescript
 * import { createGetRequest, createOkResponse } from '@thymian/core-testing';
 * import { createMockEmitter, createMockLogger } from '@thymian/core-testing/mocks';
 *
 * // Create test data
 * const request = createGetRequest({ path: '/users' });
 * const response = createOkResponse();
 *
 * // Create test doubles
 * const logger = createMockLogger();
 * const emitter = createMockEmitter();
 *
 * // Test your plugin
 * await myPlugin(emitter, logger, { cwd: '/test' });
 *
 * expect(logger.info).toHaveBeenCalled();
 * ```
 */

// ============================================================================
// Factories - Data Format
// ============================================================================

export {
  createDeleteRequest,
  createGetRequest,
  createHttpRequest,
  createPatchRequest,
  createPostRequest,
  createPutRequest,
} from './factories/http-request.factory.js';
export {
  createBadRequestResponse,
  createCreatedResponse,
  createForbiddenResponse,
  createHttpResponse,
  createInternalServerErrorResponse,
  createNoContentResponse,
  createNotFoundResponse,
  createOkResponse,
  createUnauthorizedResponse,
} from './factories/http-response.factory.js';
export {
  createOptionalParameter,
  createParameter,
  createRequiredParameter,
} from './factories/parameter.factory.js';
export {
  createArraySchema,
  createBooleanSchema,
  createIntegerSchema,
  createNumberSchema,
  createObjectSchema,
  createStringSchema,
  createThymianSchema,
} from './factories/schema.factory.js';
export {
  createThymianFormat,
  createThymianFormatWithTransaction,
  createThymianFormatWithTransactions,
} from './factories/thymian-format.factory.js';

// ============================================================================
// HTTP Testing Utilities
// ============================================================================

export {
  exampleRequestSampler,
  generateExampleParameters,
  identityHookRunner,
} from './http-testing-utils.js';
