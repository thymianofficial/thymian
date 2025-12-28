/**
 * @thymian/core-testing
 *
 * Testing utilities, factories, and mocks for the Thymian plugin ecosystem.
 *
 * This package provides reusable testing utilities that make it easy to write
 * tests for Thymian plugins and components.
 *
 * @example
 * ```typescript
 * import {
 *   createHttpRequest,
 *   createHttpResponse,
 *   createMockLogger,
 *   createMockEmitter,
 * } from '@thymian/core-testing';
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
// Mocks - Test Doubles
// ============================================================================

export {
  captureEmittedEvents,
  createEmitterWithActionHandlers,
  createEmitterWithHandlers,
  createMockEmitter,
} from './mocks/emitter.mock.js';
export {
  createMockLogger,
  createSilentMockLogger,
  createVerboseMockLogger,
} from './mocks/logger.mock.js';
export {
  createMockPlugin,
  createPluginThatEmits,
  createPluginWithMetadata,
  createSpyPluginFn,
} from './mocks/plugin.mock.js';
