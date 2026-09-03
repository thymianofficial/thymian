/**
 * Deterministic TypeScript identifiers for the declarations the type surface
 * emits.
 *
 * Every name is a pure function of the transaction's selector plus the schema's
 * role within that transaction. Naming by catalog position instead
 * (`Transaction4Type2`) is stable under a document reorder but not under an
 * *insertion*: a new endpoint that sorts first renumbers every declaration
 * after it. The surface is committed and the diff against it **is** the
 * staleness signal, so a positional name turns adding one endpoint into a
 * whole-file diff — 282 changed lines on the demo description, for one added
 * operation.
 *
 * SANITISATION IS NOT COSMETIC AND THE COLLISION SUFFIX IS NOT DEFENSIVE. A
 * selector legitimately carries characters no identifier can: a method is an
 * RFC 9110 section 5.6.2 token, paths carry `/`, `{`, `}` and percent-encoding,
 * and media types carry `/`, `+`, `;` and `=`. Two distinct selectors therefore
 * collapse onto one stem — methods `A-B` and `A.B` on the same path both
 * sanitise to `AB` — so the suffix is reached by real input.
 *
 * THE NAME WE REFERENCE AND THE NAME THE LIBRARY DECLARES ARE ONE STRING.
 * `json-schema-to-typescript` does not declare under the name it is handed: it
 * declares under `toSafeString(name)`, which re-cases a lowercase letter that
 * follows a digit (`V1beta` becomes `V1Beta`), collapses `_x` into `X` and
 * upper-cases the first letter. A positional name is already a fixed point of
 * that transform; a selector-derived one is not, and a name that changes on the
 * way in is a dangling reference on the way out. {@link safeIdentifier} is the
 * single boundary, and {@link NameRegistry} uniquifies AFTER it — so two
 * candidates that sanitise onto one identifier get a suffix rather than one
 * declaration emitted twice under two names.
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
 * The tail is lower-cased deliberately: a declaration NAME is not required to
 * be byte-exact — only the emitted selector keys and union members are — and
 * folding it keeps `JSON` and `json` from producing two visually
 * indistinguishable identifiers.
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
 * sanitise to nothing at all — `''` and `'-'` are both reachable header names
 * in a description — and an empty fragment would silently merge `Header_` with
 * the next one, so the empty case gets a name of its own rather than no name.
 */
function parameterSegment(name: string): string {
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
 * one; {@link NameRegistry} is what turns wants into names.
 *
 * A method is an RFC 9110 token, so it may be all digits (`123 /x` is a legal
 * selector), and a parameter name may start with one (`2fa`). Neither an
 * identifier nor the library's own transform tolerates a leading digit, so the
 * candidate leaves through {@link safeIdentifier} rather than through a local
 * guard.
 */
export function candidateName(selector: string, role: SchemaRole): string {
  const stem = pascalSegments(selector);

  return safeIdentifier(
    `${stem.length > 0 ? stem : 'Schema'}${roleSuffix(role)}`,
  );
}

const SAFE_CHARACTER = /[A-Za-z0-9_$]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /[0-9]/;
/**
 * A character after which the library's `toSafeString` upper-cases a following
 * lowercase letter: a digit or `$` (`([\d$]+[a-zA-Z])` upper-cases the whole
 * match) and an underscore (`_[a-z]` is collapsed into the upper-cased letter).
 */
const UPPERCASES_WHAT_FOLLOWS = /[0-9$_]/;

/**
 * An identifier `json-schema-to-typescript`'s `toSafeString` leaves alone, for
 * any input string.
 *
 * The contract is deliberately weaker than "reproduce `toSafeString`": the
 * library never sees the original, only this function's output, so all that has
 * to hold is that the output is a FIXED POINT of the library's transform. That
 * is four conditions, and each is enforced by one branch below:
 *
 * - every character is in `[A-Za-z0-9_$]`, so nothing is replaced by whitespace;
 * - the first character is never a digit, hence the `_` prefix;
 * - no lowercase letter follows a digit, a `$` or an `_`;
 * - the first character is never lowercase, so `upperFirst` is a no-op.
 *
 * A run of unusable characters is a word boundary rather than a deletion, so
 * `foo bar` and `foo-bar` both become `FooBar` — the same convention
 * {@link pascalSegments} uses, which is why applying both is harmless.
 */
export function safeIdentifier(value: string): string {
  let result = '';
  let previous = '';
  let atBoundary = true;

  for (const character of value) {
    if (!SAFE_CHARACTER.test(character)) {
      atBoundary = true;

      continue;
    }

    let next = character;

    if (
      LOWERCASE.test(next) &&
      (atBoundary ||
        result.length === 0 ||
        UPPERCASES_WHAT_FOLLOWS.test(previous))
    ) {
      next = next.toUpperCase();
    }

    if (result.length === 0 && DIGIT.test(next)) {
      result = '_';
    }

    result += next;
    previous = next;
    atBoundary = false;
  }

  return result.length > 0 ? result : 'Schema';
}

/**
 * Hands out unique identifiers, remembering what each site was given.
 *
 * The suffix order is a function of the description rather than of traversal
 * order, because the catalog is sorted by selector and each transaction's
 * schemas are visited in a fixed role order. Adding a transaction that collides
 * with an existing stem can renumber the colliding group, and only that group;
 * adding a non-colliding one — the overwhelmingly common case — renames
 * nothing.
 */
export class NameRegistry {
  private readonly used: Set<string>;
  private readonly byKey = new Map<string, string>();

  /**
   * @param reserved names nothing may be assigned, such as the fixed
   * declarations the surface emits around the generated ones.
   */
  constructor(reserved: Iterable<string> = []) {
    this.used = new Set(reserved);
  }

  /**
   * The name for `selector` in `role`, minted the first time it is asked for
   * and returned unchanged thereafter — so two references to one site cannot
   * drift apart.
   */
  nameFor(selector: string, role: SchemaRole): string {
    const key = `${selector} ${roleSuffix(role)}`;
    const existing = this.byKey.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const candidate = candidateName(selector, role);
    let name = candidate;
    let suffix = 1;

    while (this.used.has(name)) {
      suffix += 1;
      name = `${candidate}_${suffix}`;
    }

    this.used.add(name);
    this.byKey.set(key, name);

    return name;
  }
}
