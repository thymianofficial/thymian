/**
 * Compares two header field values as returned by `getHeader` for equality
 * across the two sides of a proxy hop. The raw values cannot be compared
 * structurally: a single field line may be represented either as a string or
 * as a one-element array, and for repeated field lines (string[]) the
 * repository read path does not guarantee a stable order. Values are
 * normalized to a sorted array first; an empty array is treated as an absent
 * field.
 */
export function equalHeaderValues(
  a: string | string[] | undefined,
  b: string | string[] | undefined,
): boolean {
  return (
    JSON.stringify(normalizedHeaderValue(a)) ===
    JSON.stringify(normalizedHeaderValue(b))
  );
}

function normalizedHeaderValue(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const values = Array.isArray(value) ? [...value] : [value];
  if (values.length === 0) {
    return undefined;
  }

  return values.sort();
}
