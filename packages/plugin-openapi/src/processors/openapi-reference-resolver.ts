import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

export function isReferenceObject(
  value: unknown,
): value is OpenApiV31.ReferenceObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$ref' in value &&
    typeof value.$ref === 'string'
  );
}

export function resolveOpenApiReference<T>(
  value: T | OpenApiV31.ReferenceObject,
  document: OpenApiV31.Document,
  label = 'OpenAPI object',
): T {
  if (!isReferenceObject(value)) {
    return value;
  }

  const ref = value.$ref;

  if (!ref.startsWith('#')) {
    throw new Error(
      `Only internal ${label} references are supported but got "${ref}".`,
    );
  }

  return resolveInternalReference(document, ref, label) as T;
}

function resolveInternalReference(
  document: OpenApiV31.Document,
  ref: string,
  label: string,
): unknown {
  const fragment = ref.slice(1);

  if (fragment === '') {
    return document;
  }

  if (fragment.startsWith('/')) {
    return resolveJsonPointer(document, fragment, label);
  }

  const anchor = decodeURIComponent(fragment);
  const result = findByAnchor(document, anchor);

  if (typeof result === 'undefined') {
    throw new Error(`Could not resolve internal ${label} reference "${ref}".`);
  }

  return result;
}

function resolveJsonPointer(
  root: unknown,
  pointer: string,
  label: string,
): unknown {
  let current = root;

  for (const segment of pointer.slice(1).split('/')) {
    const key = unescapeJsonPointerSegment(segment);

    if (!isObjectRecord(current) && !Array.isArray(current)) {
      throw new Error(
        `Could not resolve internal ${label} reference "#${pointer}".`,
      );
    }

    current = current[key as keyof typeof current];

    if (typeof current === 'undefined') {
      throw new Error(
        `Could not resolve internal ${label} reference "#${pointer}".`,
      );
    }
  }

  return current;
}

function findByAnchor(current: unknown, anchor: string): unknown {
  if (!current || typeof current !== 'object') {
    return undefined;
  }

  if ('$anchor' in current && current.$anchor === anchor) {
    return current;
  }

  if (Array.isArray(current)) {
    for (const item of current) {
      const result = findByAnchor(item, anchor);

      if (typeof result !== 'undefined') {
        return result;
      }
    }

    return undefined;
  }

  for (const value of Object.values(current)) {
    const result = findByAnchor(value, anchor);

    if (typeof result !== 'undefined') {
      return result;
    }
  }

  return undefined;
}

function unescapeJsonPointerSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
