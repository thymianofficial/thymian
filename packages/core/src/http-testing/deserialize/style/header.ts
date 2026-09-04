import type { SerializationStyle } from '../../../format/serialization-style/index.js';
import type { ThymianSchema } from '../../../format/thymian-schema.js';
import { deserialized, type DeserializeResult } from '../result.js';
import { splitFieldValue } from '../split.js';
import { deserializeSimple } from './simple.js';

/**
 * Headers. Only `style: simple` is defined for them, but the list grammar is
 * RFC 9110's rather than OpenAPI's, so folding is header-aware — which field
 * values are exempt from folding lives with the splitter, in `split.ts`.
 */

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

  // A header carries no percent-encoding, so there is nothing to split before
  // decoding: the single-value and per-line splitters are the same function,
  // and `deserializeSimple` picks whichever the wire form calls for.
  const split = (value: string) => splitFieldValue(name, value);

  return deserializeSimple(
    raw,
    schema,
    serializationStyle,
    () => (Array.isArray(raw) ? raw.flatMap(split) : split(raw)),
    split,
  );
}
