import type {
  ThymianActionName,
  ThymianActions,
  ThymianEventName,
  ThymianEvents,
} from '@thymian/core';
import { ThymianEmitter } from '@thymian/core';
import { vi } from 'vitest';

import { createMockLogger } from './logger.mock.js';

/**
 * Creates a mock ThymianEmitter with all methods stubbed using vi.fn().
 * Useful for testing plugins and components that depend on an emitter.
 *
 * @returns A mock ThymianEmitter instance
 *
 * @example
 * ```typescript
 * const emitter = createMockEmitter();
 *
 * // Use in tests
 * await myPlugin(emitter, logger, options);
 *
 * // Assert on calls
 * expect(emitter.emit).toHaveBeenCalledWith('core.register', expect.any(Object));
 * ```
 */
export function createMockEmitter(): ThymianEmitter {
  const emitter = new ThymianEmitter(
    createMockLogger(),
    ThymianEmitter.emptyEmitterState(),
  );

  // Spy on all methods
  vi.spyOn(emitter, 'emit');
  vi.spyOn(emitter, 'emitAction');
  vi.spyOn(emitter, 'on');
  vi.spyOn(emitter, 'onAction');
  vi.spyOn(emitter, 'onError');

  return emitter;
}

/**
 * Creates a ThymianEmitter with pre-configured event handlers.
 * Useful for testing components that emit events.
 *
 * @param handlers - Map of event names to handler functions
 * @returns A ThymianEmitter with handlers registered
 *
 * @example
 * ```typescript
 * const emitter = createEmitterWithHandlers({
 *   'core.register': vi.fn(),
 *   'core.error': vi.fn(),
 * });
 * ```
 */
export function createEmitterWithHandlers<K extends ThymianEventName>(
  handlers: Partial<
    Record<K, (event: ThymianEvents[K]) => void | Promise<void>>
  >,
): ThymianEmitter {
  const emitter = new ThymianEmitter(
    createMockLogger(),
    ThymianEmitter.emptyEmitterState(),
  );

  for (const [eventName, handler] of Object.entries(handlers) as Array<
    [K, (event: ThymianEvents[K]) => void | Promise<void>]
  >) {
    emitter.on(eventName, handler as any);
  }

  return emitter;
}

/**
 * Creates a ThymianEmitter with pre-configured action handlers.
 * Useful for testing components that request actions.
 *
 * @param handlers - Map of action names to handler functions
 * @returns A ThymianEmitter with action handlers registered
 *
 * @example
 * ```typescript
 * const emitter = createEmitterWithActionHandlers({
 *   'core.load-format': async (event) => ({ format: createThymianFormat() }),
 * });
 * ```
 */
export function createEmitterWithActionHandlers<K extends ThymianActionName>(
  handlers: Partial<
    Record<
      K,
      (
        event: ThymianActions[K]['event'],
      ) => Promise<ThymianActions[K]['response']>
    >
  >,
): ThymianEmitter {
  const emitter = new ThymianEmitter(
    createMockLogger(),
    ThymianEmitter.emptyEmitterState(),
  );

  for (const [actionName, handler] of Object.entries(handlers) as Array<
    [
      K,
      (
        event: ThymianActions[K]['event'],
      ) => Promise<ThymianActions[K]['response']>,
    ]
  >) {
    emitter.on(actionName as ThymianEventName, handler as any);
  }

  return emitter;
}

/**
 * Helper to capture all events emitted by an emitter.
 * Returns an array that will be populated with emitted events.
 *
 * @param emitter - The emitter to capture events from
 * @returns An array that captures [eventName, event] tuples
 *
 * @example
 * ```typescript
 * const emitter = createMockEmitter();
 * const events = captureEmittedEvents(emitter);
 *
 * await emitter.emit('core.register', { plugin: myPlugin });
 *
 * expect(events).toHaveLength(1);
 * expect(events[0][0]).toBe('core.register');
 * ```
 */
export function captureEmittedEvents(
  emitter: ThymianEmitter,
): Array<[ThymianEventName | ThymianActionName, any]> {
  const capturedEvents: Array<[ThymianEventName | ThymianActionName, any]> = [];

  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = vi.fn(async (eventName: any, event: any) => {
    capturedEvents.push([eventName, event]);
    return originalEmit(eventName, event);
  }) as any;

  return capturedEvents;
}
