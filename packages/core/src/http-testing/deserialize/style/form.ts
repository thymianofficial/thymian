import type { SerializationStyle } from '../../../format/serialization-style/index.js';
import type { ThymianSchema } from '../../../format/thymian-schema.js';
import { deserializeItems, deserializeObjectEntries } from '../items.js';
import {
  deserialized,
  type DeserializeResult,
  unsupported,
} from '../result.js';
import { isStructural } from '../schema.js';

/**
 * Query styles: `form` (the default) and the object reassembly shared by
 * `form`/`explode: true` and `deepObject`. The caller has already gathered the
 * scattered keys — these only decide what the gathered values mean.
 */

const QUERY_DEFAULT_STYLE: SerializationStyle = {
  style: 'form',
  explode: true,
};

/**
 * Query parameters. `items` carries the parameter's scalar wire strings —
 * every occurrence of a repeated key, or the caller's split of a delimited
 * value.
 *
 * `deepObject` is handled by `deserializeDeepObject`, because reconstructing it
 * needs the `name[prop]` keys the caller alone can see.
 */
export function deserializeQueryParameter(
  items: string[],
  schema: ThymianSchema | undefined,
  serializationStyle: SerializationStyle = QUERY_DEFAULT_STYLE,
): DeserializeResult {
  const { style, explode } = serializationStyle ?? QUERY_DEFAULT_STYLE;
  const raw = items.length === 1 ? (items[0] as string) : items;

  // A style describes how a structured value was flattened onto the wire. A
  // scalar has no structure to restore, so an unsupported style costs nothing:
  // the wire value already IS the value, and skipping validation would
  // silently drop `maxLength`/`pattern`/`enum` checks that used to run.
  if (style !== 'form' && isStructural(schema)) {
    return unsupported(serializationStyle);
  }

  return deserializeItems(items, raw, schema, explode);
}

/**
 * Reconstruct an object parameter the caller has already gathered from its
 * constituent query keys — `name[prop]=v` for `deepObject`, or bare `prop=v`
 * keys for `form`/`explode: true`. Both are only defined when exploded.
 */
export function deserializeObjectParameter(
  properties: [string, string | string[]][],
  schema: ThymianSchema | undefined,
  serializationStyle: SerializationStyle = QUERY_DEFAULT_STYLE,
): DeserializeResult {
  const { style, explode } = serializationStyle ?? QUERY_DEFAULT_STYLE;

  if (!explode || (style !== 'deepObject' && style !== 'form')) {
    return unsupported(serializationStyle);
  }

  return deserialized(deserializeObjectEntries(properties, schema, schema));
}
