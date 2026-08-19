/**
 * The three RFC 9651 top-level Structured Fields (SF) types a header field
 * can be defined as. No other field type exists in the RFC 9651/8941 grammar.
 */
export type SfFieldType = 'dictionary' | 'list' | 'item';

/**
 * The canonical natively-SF header allowlist. Ships EMPTY by design -- every
 * row requires a defining-spec citation (the header's own registration
 * document, e.g. an RFC or OSHP entry) and is authored later, in epic 646's
 * `field-grammar/` story. Do not hardcode entries here; this table is
 * injected data, populated by a future story, not this one.
 */
export const NATIVELY_SF_HEADERS: Record<string, SfFieldType> = {};

/**
 * A case-insensitive lookup over a natively-SF header allowlist.
 */
export interface SfHeaderRegistry {
  /** The header's registered SF field type, or `undefined` if unregistered. */
  fieldTypeOf(name: string): SfFieldType | undefined;
  /** Whether `name` is registered as natively SF (case-insensitive). */
  isNativelySf(name: string): boolean;
}

/**
 * Builds an {@link SfHeaderRegistry} over injected `entries`.
 *
 * Lookup is exact-name, ASCII case-insensitive (`toLowerCase()`) -- no
 * prefix/wildcard matching. Defaults to {@link NATIVELY_SF_HEADERS} (empty)
 * when no `entries` are supplied, so `createSfHeaderRegistry()` with no
 * argument is itself a valid, always-refusing registry.
 */
export function createSfHeaderRegistry(
  entries: Record<string, SfFieldType> = NATIVELY_SF_HEADERS,
): SfHeaderRegistry {
  const index = new Map<string, SfFieldType>();

  for (const [name, fieldType] of Object.entries(entries)) {
    index.set(name.toLowerCase(), fieldType);
  }

  return {
    fieldTypeOf(name: string): SfFieldType | undefined {
      return index.get(name.toLowerCase());
    },
    isNativelySf(name: string): boolean {
      return index.has(name.toLowerCase());
    },
  };
}
