import type { SerializationStyle } from '../../../format/serialization-style/index.js';
import type { ThymianSchema } from '../../../format/thymian-schema.js';
import { deserializeItems } from '../items.js';
import { type DeserializeResult, unsupported } from '../result.js';
import { isStructural } from '../schema.js';

/**
 * `style: simple` — the default for both path parameters and headers.
 * Splitting is schema-directed: only an array- or object-typed parameter is a
 * delimited list, so `Date: Mon, 02 Jan 2026` stays one value.
 */

export const SIMPLE_DEFAULT_STYLE: SerializationStyle = {
  style: 'simple',
  explode: false,
};

/**
 * Path parameters and headers, both of which default to `style: simple`.
 * Splitting happens here rather than in the caller because it is
 * schema-directed: only an array- or object-typed parameter is a delimited
 * list. `Date: Mon, 02 Jan 2026` is one string, not three items.
 */
export function deserializeSimple(
  raw: string | string[],
  schema: ThymianSchema | undefined,
  style: SerializationStyle | undefined,
  /** Split the single-value form. The caller closes over its own source, so a
   *  path can split the still-ENCODED text while `raw` is already decoded. */
  splitSingle: () => string[],
  /** Split one line of a repeated field value; headers carry no encoding. */
  splitLine: (line: string) => string[] = splitSingle,
): DeserializeResult {
  const serializationStyle = style ?? SIMPLE_DEFAULT_STYLE;

  if (serializationStyle.style !== 'simple') {
    // See deserializeQueryParameter: only a structured value loses meaning
    // under a style we cannot reverse.
    if (isStructural(schema)) {
      return unsupported(serializationStyle);
    }

    return deserializeItems(
      Array.isArray(raw) ? raw : [raw],
      raw,
      schema,
      serializationStyle.explode,
    );
  }

  const structural = isStructural(schema);
  let items: string[];

  if (Array.isArray(raw)) {
    // Repeated field lines. Each line may itself be a list, so a structural
    // schema still splits each one; a scalar schema keeps them whole so the
    // duplicate reaches the schema as the defect it is.
    items = structural ? raw.flatMap((line) => splitLine(line)) : raw;
  } else {
    items = structural ? splitSingle() : [raw];
  }

  return deserializeItems(items, raw, schema, serializationStyle.explode);
}

/**
 * Reverse `serializePathParameter` for one path parameter.
 *
 * The wire forms below are what `url-template` actually produces for the
 * templates that function builds, not a reading of the OpenAPI prose:
 *
 * ```
 *            explode: false          explode: true
 *  label     .3,4,5                  .3.4.5
 *            .role,admin,lvl,3       .role=admin.lvl=3
 *  matrix    ;id=3,4,5               ;id=3;id=4;id=5
 *            ;id=role,admin,lvl,3    ;role=admin;lvl=3
 * ```
 *
 * Array and object are structurally identical under the same style and
 * explode setting (`;id=3;id=4` vs `;role=admin;lvl=3`), so only the declared
 * schema separates them — shape comes from the description, never from
 * guessing at the value.
 *
 * A wire form that does not carry its style's prefix is malformed. It is
 * returned untouched so the schema reports it, rather than being repaired
 * into something that validates.
 */
/**
 * Split an RFC 9110 §5.6.1 `#rule` list. A comma inside a `quoted-string` is
 * data, not a delimiter — splitting on it turns one `Retry-After` date or
 * `WWW-Authenticate` challenge into several. Optional whitespace is trimmed
 * and empty members are dropped, both as §5.6.1.2 requires.
 */
