/**
 * Runtime header record shape shared by `HttpRequest`/`HttpResponse` (see
 * `../http.ts`): header name to a single value, multiple values (same-name
 * multiplicity), or `null`/`undefined` (treated as absent). `null` is wider
 * than `../http.ts`'s own `headers` type (which never emits it) -- captured
 * traffic ingested from JSON has no `undefined`, only `null`, for a missing
 * value, and `fromRuntimeHeaders` below already treats it as absent, so the
 * type should say so rather than forcing callers to cast around it.
 */
export type RuntimeHeaderRecord = Record<
  string,
  string | string[] | null | undefined
>;

/**
 * Case-insensitive, multiplicity-preserving view over a runtime header
 * record. Values are never comma-split; case-variant duplicate keys (e.g.
 * `Set-Cookie` and `set-cookie` both present) are merged in object-key
 * encounter order.
 */
export interface NormalizedHeaders {
  /** Whether any value is present for `name` (case-insensitive). */
  has(name: string): boolean;
  /**
   * The first value for `name`, or `undefined` if absent. For a header
   * that may legally repeat (e.g. `Set-Cookie`), this silently discards
   * every value after the first -- use {@link getAll} instead whenever a
   * rule cares about duplicate/multi-value detection.
   */
  get(name: string): string | undefined;
  /** Every value for `name`, in encounter order (empty array if absent). */
  getAll(name: string): string[];
  /** Every distinct header name present, case-folded to lower case. */
  names(): string[];
}

/**
 * Builds a {@link NormalizedHeaders} view over a runtime header record.
 *
 * Case-folds names ASCII-insensitively (`toLowerCase()`); `null`/`undefined`
 * entries (and empty arrays) are treated as absent -- `null` is handled
 * defensively alongside `undefined` because captured traffic ingested from
 * JSON has no `undefined`, only `null`, for a missing value. Case-variant
 * duplicate keys merge their values in the object's own key encounter order
 * (ECMA-262 guarantees this for string keys that are not themselves
 * array-index-like; a purely numeric header name -- exotic for an HTTP
 * token -- would be reordered by JS's own integer-key semantics, a
 * pre-existing property of the `Record<string, ...>` carrier type this view
 * adapts, not something introduced here). Values are never comma-split.
 */
export function fromRuntimeHeaders(
  record: RuntimeHeaderRecord | null | undefined = {},
): NormalizedHeaders {
  const index = new Map<string, string[]>();
  const headers = record ?? {};

  for (const key of Object.keys(headers)) {
    const value = headers[key];

    if (value === undefined || value === null) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];

    if (values.length === 0) {
      continue;
    }

    const lowerName = key.toLowerCase();
    const existing = index.get(lowerName);

    if (existing) {
      existing.push(...values);
    } else {
      index.set(lowerName, [...values]);
    }
  }

  return {
    has(name: string): boolean {
      return index.has(name.toLowerCase());
    },
    get(name: string): string | undefined {
      return index.get(name.toLowerCase())?.[0];
    },
    getAll(name: string): string[] {
      // Defensive copy: callers must not be able to corrupt the shared
      // internal index by mutating the array a previous call returned.
      return [...(index.get(name.toLowerCase()) ?? [])];
    },
    names(): string[] {
      return [...index.keys()];
    },
  };
}
