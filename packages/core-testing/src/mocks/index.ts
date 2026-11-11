/**
 * @thymian/core-testing/mocks
 *
 * Vitest test doubles for the Thymian plugin ecosystem. They are built on
 * `vi.fn()`, so this entry point needs `vitest` installed; the root entry
 * point does not.
 */

export {
  captureEmittedEvents,
  createEmitterWithActionHandlers,
  createEmitterWithHandlers,
  createMockEmitter,
} from './emitter.mock.js';
export { createMockLogger, createSilentMockLogger } from './logger.mock.js';
export {
  createMockPlugin,
  createPluginThatEmits,
  createPluginWithMetadata,
  createSpyPluginFn,
} from './plugin.mock.js';
export { mockState, mockThymianCore, resetMockState } from './thymian.mock.js';
