import type { Logger, LogLevel } from '@thymian/core';
import { vi } from 'vitest';

/**
 * Creates a mock Logger with all methods stubbed using vi.fn().
 * Useful for testing plugins and components that depend on a Logger.
 *
 * @param overrides - Partial logger to override defaults
 * @returns A mock Logger instance
 *
 * @example
 * ```typescript
 * const logger = createMockLogger({ namespace: 'test-plugin' });
 *
 * // Use in tests
 * myPlugin(emitter, logger, options);
 *
 * // Assert on calls
 * expect(logger.info).toHaveBeenCalledWith('Starting plugin');
 * ```
 */
export function createMockLogger(overrides: Partial<Logger> = {}): Logger {
  const logger: Logger = {
    namespace: 'mock-logger',
    level: 'warn' as LogLevel,
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    out: vi.fn(),
    child: vi.fn((name: string) =>
      createMockLogger({
        namespace: `${logger.namespace}:${name}`,
      }),
    ),
    ...overrides,
  };
  return logger;
}

/**
 * Creates a silent mock Logger that doesn't call any functions.
 * Useful when you don't want to spy on logger calls.
 *
 * @param overrides - Partial logger to override defaults
 * @returns A mock Logger instance with no-op functions
 */
export function createSilentMockLogger(
  overrides: Partial<Logger> = {},
): Logger {
  return {
    namespace: 'silent-logger',
    level: 'silent' as LogLevel,
    debug: () => undefined,
    info: () => undefined,
    error: () => undefined,
    trace: () => undefined,
    warn: () => undefined,
    out: () => undefined,
    child: (name: string) =>
      createSilentMockLogger({
        namespace: `silent-logger:${name}`,
      }),
    ...overrides,
  };
}
