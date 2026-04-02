import { Errors, Flags } from '@oclif/core';

import { safeParse } from '../safe-parse.js';

export interface PluginOptionOverride {
  pluginName: string;
  path: (string | number)[];
  value: unknown;
}

/**
 * Parse a single `-o` flag value into a structured override.
 *
 * Format: `<pluginName>.<property.path[index]...>=<value>`
 *
 * The plugin name may be scoped (`@scope/name`). The first `.` after
 * the plugin name separates it from the property path.  The property
 * path supports arbitrarily deep nesting via dot notation and bracket
 * array indexing, following the Helm `--set` convention:
 *
 *   @thymian/plugin-reporter.formatters.text.summaryOnly=true
 *   @thymian/plugin-sampler.items[0].name=Authorization
 */
export function parseOptionFlag(input: string): PluginOptionOverride {
  const eqIdx = input.indexOf('=');
  if (eqIdx === -1) {
    throw new Errors.CLIError(
      `Invalid option format: "${input}". Expected <pluginName>.<property>=<value>.`,
    );
  }

  const fullKey = input.slice(0, eqIdx);
  const rawValue = input.slice(eqIdx + 1);

  const { pluginName, propertyPath } = splitPluginNameAndPath(fullKey);

  if (!pluginName || propertyPath.length === 0) {
    throw new Errors.CLIError(
      `Invalid option format: "${input}". Expected <pluginName>.<property>=<value>.`,
    );
  }

  return {
    pluginName,
    path: propertyPath,
    value: safeParse(rawValue),
  };
}

/**
 * Split a full key like `@thymian/plugin-reporter.formatters.text.path` into
 * the plugin name (`@thymian/plugin-reporter`) and the property path segments
 * (`['formatters', 'text', 'path']`).
 *
 * Scoped packages (`@scope/name`) are handled: the plugin name extends
 * up to and including the segment that contains a `/`.
 */
function splitPluginNameAndPath(fullKey: string): {
  pluginName: string;
  propertyPath: (string | number)[];
} {
  const firstDot = fullKey.indexOf('.');
  if (firstDot === -1) {
    return { pluginName: fullKey, propertyPath: [] };
  }

  // For scoped packages (@scope/name), the plugin name extends past the
  // first dot when the portion before the first dot starts with '@' and
  // does not yet contain a '/'.
  let pluginName: string;
  let rest: string;

  const beforeDot = fullKey.slice(0, firstDot);
  if (beforeDot.startsWith('@') && !beforeDot.includes('/')) {
    // Scoped: `@scope` — need to find the next `.` after the `/`
    const slashIdx = fullKey.indexOf('/');
    if (slashIdx === -1) {
      return { pluginName: fullKey, propertyPath: [] };
    }
    const dotAfterSlash = fullKey.indexOf('.', slashIdx);
    if (dotAfterSlash === -1) {
      return { pluginName: fullKey, propertyPath: [] };
    }
    pluginName = fullKey.slice(0, dotAfterSlash);
    rest = fullKey.slice(dotAfterSlash + 1);
  } else {
    pluginName = beforeDot;
    rest = fullKey.slice(firstDot + 1);
  }

  return { pluginName, propertyPath: parsePropertyPath(rest) };
}

/**
 * Parse a dotted property path that may contain bracket-based array
 * indices into an array of string keys and numeric indices.
 *
 * Examples:
 *   `formatters.text.summaryOnly`  →  ['formatters', 'text', 'summaryOnly']
 *   `items[0].name`                →  ['items', 0, 'name']
 *   `a[1][2].b`                    →  ['a', 1, 2, 'b']
 */
export function parsePropertyPath(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const ch = path[i];

    if (ch === '.') {
      if (current) {
        segments.push(current);
        current = '';
      }
    } else if (ch === '[') {
      if (current) {
        segments.push(current);
        current = '';
      }
      const closeBracket = path.indexOf(']', i + 1);
      if (closeBracket === -1) {
        throw new Errors.CLIError(
          `Invalid property path: "${path}". Unclosed bracket at position ${i}.`,
        );
      }
      const indexStr = path.slice(i + 1, closeBracket);
      const index = Number(indexStr);
      if (!Number.isInteger(index) || index < 0) {
        throw new Errors.CLIError(
          `Invalid array index "[${indexStr}]" in property path: "${path}". Array indices must be non-negative integers.`,
        );
      }
      segments.push(index);
      i = closeBracket;
    } else {
      current += ch;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Set a deeply nested value on an object, creating intermediate objects
 * or arrays as needed based on the path segments.
 */
export function deepSet(
  obj: Record<string, unknown>,
  path: (string | number)[],
  value: unknown,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]!;
    const nextSegment = path[i + 1]!;

    if (current[segment] === undefined || current[segment] === null) {
      current[segment] = typeof nextSegment === 'number' ? [] : {};
    }

    current = current[segment];
  }

  const lastSegment = path[path.length - 1]!;
  current[lastSegment] = value;
}

export const optionFlag = Flags.custom<PluginOptionOverride>({
  description:
    'Override plugin options. Format: <pluginName>.<property.path>=<value>. ' +
    'Supports nested paths (dot notation) and array indices (bracket notation).',
  multiple: true,
  helpValue: '<plugin>.<path>=<value>',
  charAliases: ['o'],
  helpGroup: 'BASE',
  parse: async (input: string) => parseOptionFlag(input),
});
