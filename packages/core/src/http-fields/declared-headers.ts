import type { Parameter } from '../format/parameter.js';
import type { ThymianSchema } from '../format/thymian-schema.js';

/**
 * Declared header record shape used by `ThymianHttpRequest`/
 * `ThymianHttpResponse` (see `../format/nodes/http-request.node.ts` /
 * `http-response.node.ts`): header name to its declared `Parameter`.
 */
export type DeclaredHeaderRecord = Record<string, Parameter>;

/**
 * Which direct schema keyword pinned the header's value, and what a rule can
 * do with the `value` that comes with it:
 *
 * - `const` -- the single declared value; evaluate it directly.
 * - `enum` -- a candidate set (`value` is an array); the declaration permits
 *   any member, so the header conforms only if EVERY member conforms.
 * - `default` -- the value assumed when the sender omits the header;
 *   evaluate it directly, but it is an assumption, not a guarantee.
 * - `pattern` -- a regex source string, NOT a value; a rule cannot read a
 *   declared value out of it, only reason about the constraint.
 *
 * `kind` says what the pin *is*, never how loudly to report it: a finding's
 * severity comes from the rule's own tier tag, not from which keyword
 * happened to pin the value.
 */
export type PinKind = 'const' | 'enum' | 'pattern' | 'default';

/** The pinned value and which schema keyword pinned it. */
export interface PinFact {
  kind: PinKind;
  value: unknown;
}

/**
 * Two-tier declared-header facts for a single header name.
 *
 * L1 (`present`, `required`) is always available. L2 (`pins`) carries one
 * {@link PinFact} per value-pinning keyword the header's OWN schema sets --
 * schema composition (`allOf`/`oneOf`/`$ref`) is never resolved to find one.
 * A loose schema pins nothing and yields an empty `pins`.
 *
 * Every pin is reported rather than one precedence winner, because the four
 * keywords are not interchangeable for the consumer: `const`/`enum`/`default`
 * carry values a rule can evaluate, `pattern` only a constraint. A single
 * slot loses the value of any schema that pins both -- `{ pattern: '^v\\d+$',
 * default: 'v1' }` would surrender `'v1'`, the one value it declares -- and
 * this view is the only route a lint-context rule has to a declared value.
 */
export interface DeclaredHeaderFacts {
  present: boolean;
  required: boolean;
  pins: PinFact[];
}

/** Looks up the declared facts for one header name (case-insensitive). */
export type DeclaredHeaderLookup = (name: string) => DeclaredHeaderFacts;

/**
 * Builds a {@link DeclaredHeaderLookup} over a declared header record
 * (e.g. `ThymianHttpRequest.headers` / `ThymianHttpResponse.headers`).
 *
 * A name absent from `record` (case-insensitively) yields
 * `{ present: false, required: false, pins: [] }`. A name present but whose
 * schema pins no value yields L1 only (`present`, `required`) with an empty
 * `pins`.
 *
 * Unlike the runtime view, a declared record with two case-variant keys for
 * the same name (e.g. both `Set-Cookie` and `set-cookie` declared) does NOT
 * merge -- there is no single "value" to merge, only a schema per key, so
 * the first case-insensitive match in `Object.keys(record)` order wins.
 * That is intentional, not an oversight: two declared Parameters for the
 * same header name differing only by case is itself an anomalous spec.
 */
export function fromDeclaredHeaders(
  record: DeclaredHeaderRecord,
): DeclaredHeaderLookup {
  // Precomputed once per call to `fromDeclaredHeaders`, not per lookup --
  // callers may query many header names per request/response, and this
  // turns each of those from an O(n) `Object.keys` scan into an O(1) get.
  // First case-insensitive match in `Object.keys(record)` order wins (same
  // as the scan it replaces): only the first occurrence of a lower-cased
  // name is recorded.
  const keyByLowerName = new Map<string, string>();

  for (const key of Object.keys(record)) {
    const lowerName = key.toLowerCase();

    if (!keyByLowerName.has(lowerName)) {
      keyByLowerName.set(lowerName, key);
    }
  }

  return (name: string): DeclaredHeaderFacts => {
    const key = keyByLowerName.get(name.toLowerCase());

    if (key === undefined) {
      return { present: false, required: false, pins: [] };
    }

    // `key` came from `keyByLowerName`, built from `Object.keys(record)`,
    // so this lookup always hits.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parameter = record[key]!;

    return {
      present: true,
      required: parameter.required,
      pins: collectPins(parameter.schema),
    };
  };
}

/**
 * Deep-copies an array or object pin value so a consumer mutating a returned
 * pin cannot corrupt the caller's own declared spec model -- shared across
 * every rule inspecting this header, and the same model that gets persisted
 * back out. Primitives (and `null`) pass through unchanged; they're already
 * immutable, so there is nothing to protect.
 *
 * A shallow copy would not be enough: it leaves every nested object aliased,
 * so one rule normalising `pin.value.csp.mode` in place would still change
 * what later rules see.
 *
 * `structuredClone` does the copying, but it is guarded: `ThymianSchema`'s
 * `const`/`default` are `unknown`, and a spec model can be authored in
 * TypeScript and loaded through jiti, so a pin may legally hold a value
 * `structuredClone` rejects -- a function or symbol property raises
 * `DataCloneError`. Rather than let that escape a read-only facts lookup,
 * fall back to a shallow copy -- weaker protection for an exotic pin, but
 * never a throw. (A class instance does not throw; it clones as a plain
 * object, dropping its prototype, which the shallow spread did too.)
 */
function copyPinValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return Array.isArray(value) ? [...value] : { ...value };
  }
}

/**
 * Collects every L2 pin fact from a header's own direct schema keywords, in
 * `const` > `enum` > `default` > `pattern` order -- the three value-carrying
 * keywords first, the `pattern` constraint last, so a consumer taking
 * `pins[0]` gets a value whenever the schema declares one at all. A schema
 * setting several keywords at once is not itself validated; all of them are
 * reported and the rule decides which it can act on. Never resolves
 * `allOf`/`oneOf`/`$ref` composition to find a pin -- out of scope by design.
 */
function collectPins(schema: ThymianSchema): PinFact[] {
  const pins: PinFact[] = [];

  if (schema.const !== undefined) {
    pins.push({ kind: 'const', value: copyPinValue(schema.const) });
  }

  if (schema.enum !== undefined) {
    pins.push({ kind: 'enum', value: schema.enum.map(copyPinValue) });
  }

  if (schema.default !== undefined) {
    pins.push({ kind: 'default', value: copyPinValue(schema.default) });
  }

  if (schema.pattern !== undefined) {
    pins.push({ kind: 'pattern', value: schema.pattern });
  }

  return pins;
}
