import type { Parameter } from '@thymian/core';

import { createStringSchema } from './schema.factory.js';

/**
 * Creates a Parameter with sensible defaults.
 * All properties can be overridden.
 *
 * @param overrides - Partial parameter to override defaults
 * @returns A complete Parameter object
 *
 * @example
 * ```typescript
 * const requiredParam = createParameter({ required: true });
 * const customParam = createParameter({
 *   description: 'User ID',
 *   required: true,
 *   schema: createIntegerSchema()
 * });
 * ```
 */
export function createParameter(overrides: Partial<Parameter> = {}): Parameter {
  return {
    required: false,
    schema: createStringSchema(),
    style: {
      explode: false,
      style: 'simple',
    },
    ...overrides,
  };
}

/**
 * Creates a required Parameter
 */
export function createRequiredParameter(
  overrides: Partial<Parameter> = {},
): Parameter {
  return createParameter({
    required: true,
    ...overrides,
  });
}

/**
 * Creates an optional Parameter
 */
export function createOptionalParameter(
  overrides: Partial<Parameter> = {},
): Parameter {
  return createParameter({
    required: false,
    ...overrides,
  });
}
