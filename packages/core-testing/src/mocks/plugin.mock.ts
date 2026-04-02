import type { ThymianPlugin, ThymianPluginFn } from '@thymian/core';
import { vi } from 'vitest';

/**
 * Creates a mock ThymianPlugin with sensible defaults.
 * All properties can be overridden.
 *
 * @param overrides - Partial plugin to override defaults
 * @returns A complete ThymianPlugin object
 *
 * @example
 * ```typescript
 * const plugin = createMockPlugin({
 *   name: 'test-plugin',
 *   plugin: async (emitter, logger, options) => {
 *     // Plugin logic
 *   }
 * });
 * ```
 */
export function createMockPlugin<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
>(overrides: Partial<ThymianPlugin<Options>> = {}): ThymianPlugin<Options> {
  const defaultPlugin: ThymianPluginFn<Options & { cwd: string }> = vi.fn(
    async () => {
      // Default no-op plugin
    },
  );

  return {
    name: 'mock-plugin',
    version: '0.0.1',
    plugin: defaultPlugin,
    ...overrides,
  } as ThymianPlugin<Options>;
}

/**
 * Creates a spy plugin function that can be used with createMockPlugin.
 * Useful when you want to test what arguments are passed to the plugin.
 *
 * @param implementation - Optional plugin implementation
 * @returns A spy function compatible with ThymianPluginFn
 *
 * @example
 * ```typescript
 * const pluginFn = createSpyPluginFn(async (emitter, logger, options) => {
 *   logger.info('Plugin started');
 * });
 *
 * const plugin = createMockPlugin({ plugin: pluginFn });
 *
 * await plugin.plugin(emitter, logger, options);
 * expect(pluginFn).toHaveBeenCalledWith(emitter, logger, options);
 * ```
 */
export function createSpyPluginFn<
  Options extends Record<PropertyKey, unknown> & { cwd: string } = {
    cwd: string;
  },
>(implementation?: ThymianPluginFn<Options>): ThymianPluginFn<Options> {
  return vi.fn(implementation || (() => Promise.resolve()));
}

/**
 * Creates a plugin that emits a specific event when executed.
 * Useful for testing event flow between plugins.
 *
 * @param eventName - The event name to emit
 * @param eventData - The event data to emit
 * @param overrides - Additional plugin overrides
 * @returns A ThymianPlugin that emits the specified event
 *
 * @example
 * ```typescript
 * const plugin = createPluginThatEmits('core.register', {
 *   plugin: somePlugin
 * });
 * ```
 */
export function createPluginThatEmits<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
>(
  eventName: string,
  eventData: any,
  overrides: Partial<ThymianPlugin<Options>> = {},
): ThymianPlugin<Options> {
  return createMockPlugin<Options>({
    plugin: async (emitter, logger, options) => {
      await emitter.emit(eventName as any, eventData);
    },
    ...overrides,
  });
}

/**
 * Creates a plugin with event and action metadata configured.
 * Useful for testing plugin registration and capability declaration.
 *
 * @param config - Plugin configuration including events and actions
 * @returns A ThymianPlugin with metadata
 *
 * @example
 * ```typescript
 * const plugin = createPluginWithMetadata({
 *   name: 'my-plugin',
 *   events: {
 *     emits: ['core.register'],
 *     listensOn: ['core.ready']
 *   },
 *   actions: {
 *     provides: {
 *       'core.format.load': { event: {}, response: {} }
 *     }
 *   }
 * });
 * ```
 */
export function createPluginWithMetadata<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
>(config: Partial<ThymianPlugin<Options>>): ThymianPlugin<Options> {
  return createMockPlugin<Options>(config);
}
