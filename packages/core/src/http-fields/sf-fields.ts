/**
 * The three RFC 9651 top-level Structured Fields (SF) types a header field
 * can be defined as. No other field type exists in the RFC 9651/8941 grammar.
 */
export type SfFieldType = 'dictionary' | 'list' | 'item';

/**
 * The canonical natively-SF header allowlist. Ships EMPTY by design -- every
 * row requires a defining-spec citation (the header's own registration
 * document, e.g. an RFC or OSHP entry), authored later by the header-grammar
 * work. Do not hardcode entries here; this table is injected data, populated
 * once that work lands, not by this module.
 */
// Frozen: this is also `createSfHeaderRegistry`'s live default parameter
// binding, so an accidental in-place write by an importer would otherwise
// silently corrupt the shared canonical table for every subsequent
// no-argument call.
export const NATIVELY_SF_HEADERS: Readonly<Record<string, SfFieldType>> =
  Object.freeze({});

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
  entries: Readonly<Record<string, SfFieldType>> = NATIVELY_SF_HEADERS,
): SfHeaderRegistry {
  const index = new Map<string, SfFieldType>();

  // Case-variant duplicate keys in `entries` (e.g. both `X-Test` and
  // `x-test` present) resolve via last-write-wins, per `Object.entries`
  // iteration (== object key insertion) order -- intentional, not an
  // oversight; unlike the sibling `declared-headers.ts` (which documents
  // and tests its own analogous collision as first-match-wins), there is no
  // "first" registration to prefer here, so the last entry simply
  // overwrites the index slot as each is set.
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
