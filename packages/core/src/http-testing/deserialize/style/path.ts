import type {
  SerializationStyle,
  Style,
} from '../../../format/serialization-style/index.js';
import type { ThymianSchema } from '../../../format/thymian-schema.js';
import { deserializeItems } from '../items.js';
import { type DeserializeResult, malformed } from '../result.js';
import { structuralKind } from '../schema.js';
import { splitWireList } from '../split.js';
import { deserializeSimple, SIMPLE_DEFAULT_STYLE } from './simple.js';

/**
 * Path styles `label` and `matrix`, and the dispatch for all three path
 * styles. `simple` lives in its own module because headers share it.
 */

interface StyledPathValue {
  /** The wire value split into scalar items. */
  items: string[];
  /** The same value with its style packaging removed — the text the client
   *  actually sent, used when the items turn out not to fit the schema. */
  body: string;
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
 *  scalars   .5                      ;id=5      (RFC 6570 omits `=` when empty)
 * ```
 *
 * Array and object are structurally identical under the same style and explode
 * setting (`;id=3;id=4` vs `;role=admin;lvl=3`), so only the declared schema
 * separates them — via `structuralKind`, the same accessor the typing step
 * uses, so the two can never disagree.
 *
 * Returns `undefined` when the value is not in its declared style at all. The
 * caller turns that into an assertion failure: the description says how the
 * value must be encoded, and it is not.
 */
function splitStyledPath(
  name: string,
  raw: string,
  schema: ThymianSchema | undefined,
  { style, explode }: SerializationStyle,
  decode: (item: string) => string,
): StyledPathValue | undefined {
  const kind = structuralKind(schema);

  // A scalar is never a delimited list, so `explode` cannot apply and the whole
  // remainder is the value — `.1.5` is the number 1.5, not two items.
  const listDelimiter = (styleDelimiter: string) =>
    kind === undefined ? undefined : explode ? styleDelimiter : ',';

  const split = (body: string, delimiter: string | undefined): string[] =>
    delimiter === undefined
      ? [decode(body)]
      : // An empty body after a present prefix is one empty member, not zero.
        body === ''
        ? ['']
        : splitWireList(body, decode, { delimiter });

  if (style === 'label') {
    if (!raw.startsWith('.')) {
      return undefined;
    }

    const body = raw.slice(1);

    return {
      items: split(body, listDelimiter('.')),
      body: decode(body),
    };
  }

  if (style !== 'matrix') {
    return undefined;
  }

  if (explode && kind !== undefined) {
    // `;id=3;id=4` (array) or `;role=admin;lvl=3` (object).
    if (!raw.startsWith(';')) {
      return undefined;
    }

    const segments = raw.slice(1).split(';');

    if (segments.length === 0 || segments.some((segment) => segment === '')) {
      return undefined;
    }

    if (kind === 'object') {
      const keys = segments.map((segment) => segment.split('=')[0] ?? '');

      // A repeated property is a client defect, not a merge to silently apply.
      if (new Set(keys).size !== keys.length) {
        return undefined;
      }

      return {
        items: segments.map(decode),
        body: segments.map(decode).join(';'),
      };
    }

    // Every member of an exploded array repeats `;name=`.
    if (!segments.every((segment) => segment.startsWith(`${name}=`))) {
      return undefined;
    }

    const items = segments.map((segment) =>
      decode(segment.slice(name.length + 1)),
    );

    return { items, body: items.join(';') };
  }

  // RFC 6570's `;` operator omits `=` entirely when the value is empty, so
  // `;id` is the empty string — the form thymian's own serializer emits.
  if (raw === `;${name}`) {
    return { items: [''], body: '' };
  }

  const prefix = `;${name}=`;

  if (!raw.startsWith(prefix)) {
    return undefined;
  }

  const body = raw.slice(prefix.length);

  // The serializer percent-encodes a literal `;`, so a bare one here is the
  // start of a *different* matrix parameter, never part of this value.
  if (body.includes(';')) {
    return undefined;
  }

  return { items: split(body, listDelimiter(',')), body: decode(body) };
}

/**
 * The styles OpenAPI defines for a path parameter, as a table rather than a
 * branch: what a location supports is part of its shape, not something a
 * reader has to reconstruct from `if`s. A style absent from this table is one
 * thymian will not reverse, and says so.
 */
const PATH_STYLES: Partial<
  Record<
    Style,
    (
      name: string,
      raw: string,
      schema: ThymianSchema | undefined,
      style: SerializationStyle,
      decode: (item: string) => string,
    ) => DeserializeResult
  >
> = {
  simple: (_name, raw, schema, style, decode) =>
    deserializeSimple(decode(raw), schema, style, () =>
      splitWireList(raw, decode),
    ),
  label: reversePrefixedStyle,
  matrix: reversePrefixedStyle,
};

/** `label` and `matrix` share everything but their prefix and delimiter. */
function reversePrefixedStyle(
  name: string,
  raw: string,
  schema: ThymianSchema | undefined,
  style: SerializationStyle,
  decode: (item: string) => string,
): DeserializeResult {
  const split = splitStyledPath(name, raw, schema, style, decode);

  // The style is reversible and this value is not in it — a description
  // violation, reported as such rather than quietly handed to a schema that
  // may well accept the packaging as a plain string.
  if (!split) {
    return malformed(style);
  }

  // The style prefix is packaging, not part of the value: a `string`-typed
  // `.abc` is `abc`. A value that does not fit its schema is reported as the
  // text the client sent, never as the items it was split into.
  const { items, body } = split;

  return deserializeItems(
    items,
    items.length === 1 ? (items[0] as string) : body,
    schema,
    style.explode,
  );
}

export function deserializePathParameter(
  name: string,
  raw: string,
  schema: ThymianSchema | undefined,
  serializationStyle?: SerializationStyle,
  decode: (item: string) => string = (item) => item,
): DeserializeResult {
  const style = serializationStyle ?? SIMPLE_DEFAULT_STYLE;
  const reverse = PATH_STYLES[style.style];

  if (!reverse) {
    // Not a path style at all. A scalar still validates — see
    // `deserializeSimple` — so only a structured value is forfeited.
    return deserializeSimple(decode(raw), schema, style, () =>
      splitWireList(raw, decode),
    );
  }

  return reverse(name, raw, schema, style, decode);
}
