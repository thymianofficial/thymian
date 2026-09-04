import type { HttpRequestTemplate } from '@thymian/core';

import type { EndpointRequest } from './hook-utils.js';

/**
 * Overlays a caller's arguments onto a generated request.
 *
 * The generated sample plus the target's own hooks already produce a complete,
 * schema-satisfying request. Arguments are therefore an **overlay**, not a
 * replacement: a seeding call states the one field that has to differ — a name
 * it will assert on later, an id it just created — and inherits everything
 * else. Requiring the whole request instead made the caller re-state a body
 * the description had already described.
 *
 * Parameter groups merge per key. The body deep-merges (see
 * {@link deepMergeBody}).
 */
export function applyArgs(
  template: HttpRequestTemplate,
  args: EndpointRequest,
): HttpRequestTemplate {
  return {
    ...template,
    headers: { ...template.headers, ...args.headers },
    query: { ...template.query, ...args.query },
    cookies: { ...template.cookies, ...args.cookies },
    pathParameters: { ...template.pathParameters, ...args.path },
    ...('body' in args
      ? { body: deepMergeBody(template.body, args.body) }
      : {}),
  };
}

/**
 * Merges an overlay body onto the generated one: **objects recurse, arrays and
 * primitives replace, `null` overrides.**
 *
 * Arrays replace rather than merge because a positional merge needs an index
 * the caller cannot know is stable, and a per-element merge would produce
 * elements the schema never described. `null` overrides for the same reason it
 * is not "absent": a description that allows `null` means it, and merging
 * around it would make the one value you cannot express the one you meant.
 *
 * Written here rather than taken from a library so that the rule the generated
 * `DeepPartial` types promise and the rule the runtime applies are the same
 * three sentences, in one place.
 */
export function deepMergeBody(base: unknown, overlay: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return overlay;
  }

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = key in base ? deepMergeBody(base[key], value) : value;
  }

  return merged;
}

/**
 * A JSON object, and nothing that merely looks like one.
 *
 * `null`, arrays, `Buffer`s and dates all answer `'object'` to `typeof`, and
 * every one of them is a value the caller means to replace whole.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
}
