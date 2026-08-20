/**
 * Deterministic TypeScript identifiers for the declarations the generated type
 * surface emits.
 *
 * Every name is a pure function of the transaction's selector plus the schema's
 * role within that transaction. v1 named declarations with a positional counter
 * (`GeneratedSchema1..N`), so inserting one operation renumbered every later
 * declaration. The v2 surface is committed and the diff against it *is* the
 * staleness signal, which makes a positional name a whole-file diff on every
 * insertion.
 *
 * SANITISATION IS NOT COSMETIC, AND THE COLLISION SUFFIX IS NOT DEFENSIVE. A
 * selector legitimately carries characters no identifier can: the method charset
 * is RFC 9110 section 5.6.2 `tchar` (including the backtick), paths carry `/`,
 * `{`, `}` and percent-encoding, and media types carry `/`, `+`, `;`, `=` and
 * spaces. Two distinct selectors therefore collapse onto one stem — a method
 * `A-B` and a method `A.B` on the same path both sanitise to `AB` — so the
 * suffix is reached by real input, not only by paranoia.
 *
 * The suffix order is a function of the selector SET, never of iteration order:
 * candidates are assigned in sorted order of their site key. Adding a
 * transaction that collides with an existing stem can therefore renumber the
 * colliding group (and only that group); adding a non-colliding transaction —
 * the overwhelmingly common case — never renames anything.
 */

/** Which schema of a transaction a declaration was generated for. */
export type SchemaRole =
  | { readonly kind: 'request-body' }
  | { readonly kind: 'response-body' }
  | { readonly kind: 'query-parameter'; readonly parameter: string }
  | { readonly kind: 'path-parameter'; readonly parameter: string }
  | { readonly kind: 'request-header'; readonly parameter: string }
  | { readonly kind: 'cookie'; readonly parameter: string }
  | { readonly kind: 'response-header'; readonly parameter: string };

/**
 * Splits on every run of non-alphanumeric characters and upper-cases each
 * remaining segment's first character, so `GET`, `astronauts`, `{id}` and
 * `application/vnd.Example+JSON` become `Get`, `Astronauts`, `Id` and
 * `ApplicationVndExampleJson`.
 *
 * The tail is lower-cased deliberately: a declaration NAME is not required to be
 * byte-exact (only the emitted key and the union members are), and folding it
 * keeps `JSON` and `json` from producing two visually indistinguishable
 * identifiers.
 */
export function pascalSegments(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map(
      (segment) =>
        `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`,
    )
    .join('');
}

/**
 * A valid identifier fragment for a parameter name. A parameter name may
 * sanitise to nothing at all — `Record` keys of `''` and `'-'` are both
 * reachable — and an empty fragment would silently merge `Header_` with the
 * next one, so the empty case gets a name of its own rather than no name.
 */
export function parameterSegment(name: string): string {
  const segment = pascalSegments(name);

  return segment.length > 0 ? segment : 'Unnamed';
}

/** The role's contribution to a declaration name. */
export function roleSuffix(role: SchemaRole): string {
  switch (role.kind) {
    case 'request-body':
      return 'RequestBody';
    case 'response-body':
      return 'ResponseBody';
    case 'query-parameter':
      return `QueryParam_${parameterSegment(role.parameter)}`;
    case 'path-parameter':
      return `PathParam_${parameterSegment(role.parameter)}`;
    case 'request-header':
      return `Header_${parameterSegment(role.parameter)}`;
    case 'cookie':
      return `Cookie_${parameterSegment(role.parameter)}`;
    case 'response-header':
      return `ResponseHeader_${parameterSegment(role.parameter)}`;
  }
}

/**
 * The identifier a selector plus a role WANTS. Several sites may want the same
 * one; {@link assignUniqueNames} is what turns wants into names.
 *
 * A method is an RFC 9110 `tchar` token, so it may be all digits (`123 /x` is a
 * legal selector). An identifier may not start with one, hence the underscore.
 */
export function candidateName(selector: string, role: SchemaRole): string {
  const stem = pascalSegments(selector);
  const candidate = `${stem.length > 0 ? stem : 'Schema'}${roleSuffix(role)}`;

  return /^[0-9]/.test(candidate) ? `_${candidate}` : candidate;
}

/** A site asking for a name, identified by a key that is unique and sortable. */
export type NameRequest = {
  readonly key: string;
  readonly candidate: string;
};

/** Byte-order comparison. `localeCompare` is locale-dependent, so it would make
 * the emitted file depend on the machine that generated it. */
export function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

/**
 * Resolves every request to a unique identifier, deterministically.
 *
 * Assignment walks the requests in sorted key order and hands the bare
 * candidate to the first claimant; later claimants get `_2`, `_3`, … The `used`
 * set is consulted rather than a per-candidate counter because a suffixed name
 * can itself be somebody's bare candidate: a site wanting `Foo_2` and two sites
 * wanting `Foo` must still end up with three distinct names.
 */
export function assignUniqueNames(
  requests: Iterable<NameRequest>,
): Map<string, string> {
  const sorted = [...requests].sort((a, b) => compareStrings(a.key, b.key));
  const used = new Set<string>();
  const assigned = new Map<string, string>();

  for (const request of sorted) {
    let name = request.candidate;
    let suffix = 1;

    while (used.has(name)) {
      suffix += 1;
      name = `${request.candidate}_${suffix}`;
    }

    used.add(name);
    assigned.set(request.key, name);
  }

  return assigned;
}
