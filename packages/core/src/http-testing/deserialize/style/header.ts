import type { SerializationStyle } from '../../../format/serialization-style/index.js';
import type { ThymianSchema } from '../../../format/thymian-schema.js';
import { deserialized, type DeserializeResult } from '../result.js';
import { splitHeaderList } from '../split.js';
import { deserializeSimple } from './simple.js';

/**
 * Headers. Only `style: simple` is defined for them, but the list grammar is
 * RFC 9110's rather than OpenAPI's, so folding is header-aware.
 */

const NON_LIST_HEADERS = new Set(['set-cookie']);

export function deserializeHeaderParameter(
  name: string,
  raw: string | string[] | undefined,
  schema: ThymianSchema | undefined,
  serializationStyle?: SerializationStyle,
): DeserializeResult {
  // An absent header has no wire form to deserialize; pass it through so the
  // schema reports it exactly as it did before.
  if (raw === undefined) {
    return deserialized(undefined);
  }

  const foldable = !NON_LIST_HEADERS.has(name.toLowerCase());

  const split = (value: string) =>
    foldable ? splitHeaderList(value) : [value];

  return deserializeSimple(
    raw,
    schema,
    serializationStyle,
    () => split(Array.isArray(raw) ? raw.join(',') : raw),
    split,
  );
}
