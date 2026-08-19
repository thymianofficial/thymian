import type { Parameter } from '../format/parameter.js';
import type { ThymianSchema } from '../format/thymian-schema.js';

/**
 * Declared header record shape used by `ThymianHttpRequest`/
 * `ThymianHttpResponse` (see `../format/nodes/http-request.node.ts` /
 * `http-response.node.ts`): header name to its declared `Parameter`.
 */
export type DeclaredHeaderRecord = Record<string, Parameter>;

/** Which direct schema keyword pinned the header's value. */
export type PinKind = 'const' | 'enum' | 'pattern' | 'default';

/** The pinned value and which schema keyword pinned it. */
export interface PinFact {
  kind: PinKind;
  value: unknown;
}

/**
 * Two-tier declared-header facts for a single header name.
 *
 * L1 (`present`, `required`) is always available. L2 (`pin`) is present
 * only when the header's own `schema.const`/`enum`/`pattern`/`default`
 * pins a value directly -- schema composition (`allOf`/`oneOf`/`$ref`) is
 * never resolved to find one.
 */
export interface DeclaredHeaderFacts {
  present: boolean;
  required: boolean;
  pin?: PinFact;
}

/** Looks up the declared facts for one header name (case-insensitive). */
export type DeclaredHeaderLookup = (name: string) => DeclaredHeaderFacts;

/**
 * Builds a {@link DeclaredHeaderLookup} over a declared header record
 * (e.g. `ThymianHttpRequest.headers` / `ThymianHttpResponse.headers`).
 *
 * A name absent from `record` (case-insensitively) yields
 * `{ present: false, required: false }`. A name present but whose schema
 * pins no value yields L1 only (`present`, `required`), no `pin`.
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
  return (name: string): DeclaredHeaderFacts => {
    const key = Object.keys(record).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase(),
    );

    if (key === undefined) {
      return { present: false, required: false };
    }

    // `key` came from `Object.keys(record)`, so this lookup always hits.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parameter = record[key]!;
    const pin = derivePin(parameter.schema);

    return {
      present: true,
      required: parameter.required,
      ...(pin ? { pin } : {}),
    };
  };
}

/**
 * Derives the L2 pin fact from a header's own direct schema keywords, in
 * `const` > `enum` > `pattern` > `default` precedence (tested; a schema
 * pinning more than one keyword at once is not itself validated -- this is
 * simply which one wins). Never resolves `allOf`/`oneOf`/`$ref` composition
 * to find one -- out of scope by design.
 */
function derivePin(schema: ThymianSchema): PinFact | undefined {
  if (schema.const !== undefined) {
    return { kind: 'const', value: schema.const };
  }

  if (schema.enum !== undefined) {
    // Copied, not the caller's own array reference -- schema.enum belongs
    // to the caller's declared spec model, potentially shared across every
    // rule inspecting this header, and must not be corruptible by a
    // consumer mutating the returned pin fact.
    return { kind: 'enum', value: [...schema.enum] };
  }

  if (schema.pattern !== undefined) {
    return { kind: 'pattern', value: schema.pattern };
  }

  if (schema.default !== undefined) {
    return { kind: 'default', value: schema.default };
  }

  return undefined;
}
