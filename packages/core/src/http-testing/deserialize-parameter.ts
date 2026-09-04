/**
 * The inverse of `serialize-parameter.ts`.
 *
 * Parameter values are strings on the wire by definition — OpenAPI's
 * `style`/`explode` rules describe how typed values are *serialized into* them.
 * Validating the wire form against the parameter's schema therefore reports
 * every non-string parameter as a type violation. These helpers rebuild the
 * typed value first, so the schema is validated against what the description
 * actually describes.
 *
 * The work splits three ways, and each part is ignorant of the others:
 *
 * - `deserialize/schema.ts` — what type is this, really (through `$ref`,
 *   `allOf`, `anyOf`/`oneOf`, `enum`, `const`), and is this wire string an
 *   unambiguous lexical form of it. Knows nothing about styles.
 * - `deserialize/style/*.ts` — one module per serialization style, reversing
 *   the wire form into a list of scalar strings. Knows nothing about types
 *   beyond "is this a list".
 * - `deserialize/items.ts` — the shared typing step both feed.
 *
 * Deserialization is **schema-directed and conservative**: it converts only
 * when the wire form is an unambiguous lexical representation of the target
 * type, and otherwise returns the string untouched so the genuine schema error
 * still fires. It never guesses a type from the value alone.
 *
 * **Splitting happens before decoding, and only when the schema calls for it.**
 * `?ids=a%2Cb` is one item, not two, so a delimiter is split on the encoded
 * form and each item decoded afterwards. A `string`-typed parameter is never
 * split at all: `Date: Mon, 02 Jan 2026` is one value.
 */

export * from './deserialize/result.js';
export {
  deserializeScalar,
  flattenSchema,
  schemaTypes,
  structuralKind,
} from './deserialize/schema.js';
export * from './deserialize/split.js';
export {
  deserializeObjectParameter,
  deserializeQueryParameter,
} from './deserialize/style/form.js';
export { deserializeHeaderParameter } from './deserialize/style/header.js';
export { deserializePathParameter } from './deserialize/style/path.js';
