import type { ThymianSchema } from '@thymian/core';

/**
 * Creates a ThymianSchema with sensible defaults.
 * All properties can be overridden.
 *
 * @param overrides - Partial schema to override defaults
 * @returns A complete ThymianSchema object
 *
 * @example
 * ```typescript
 * const stringSchema = createThymianSchema({ type: 'string', minLength: 5 });
 * const objectSchema = createThymianSchema({
 *   type: 'object',
 *   properties: {
 *     name: createThymianSchema({ type: 'string' })
 *   }
 * });
 * ```
 */
export function createThymianSchema(
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return {
    type: 'string',
    ...overrides,
  };
}

/**
 * Creates a string schema with sensible defaults
 */
export function createStringSchema(
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return createThymianSchema({
    type: 'string',
    ...overrides,
  });
}

/**
 * Creates a number schema with sensible defaults
 */
export function createNumberSchema(
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return createThymianSchema({
    type: 'number',
    ...overrides,
  });
}

/**
 * Creates an integer schema with sensible defaults
 */
export function createIntegerSchema(
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return createThymianSchema({
    type: 'integer',
    ...overrides,
  });
}

/**
 * Creates a boolean schema with sensible defaults
 */
export function createBooleanSchema(
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return createThymianSchema({
    type: 'boolean',
    ...overrides,
  });
}

/**
 * Creates an object schema with sensible defaults
 */
export function createObjectSchema(
  properties: Record<string, ThymianSchema> = {},
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return createThymianSchema({
    type: 'object',
    properties,
    ...overrides,
  });
}

/**
 * Creates an array schema with sensible defaults
 */
export function createArraySchema(
  items: ThymianSchema = createStringSchema(),
  overrides: Partial<ThymianSchema> = {},
): ThymianSchema {
  return createThymianSchema({
    type: 'array',
    items,
    ...overrides,
  });
}
