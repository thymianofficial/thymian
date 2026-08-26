import type {
  SerializationStyle,
  Style,
} from '../../format/serialization-style/index.js';

/**
 * A wire value that was not deserialized. Two distinct situations, deliberately
 * kept apart because they blame different parties:
 *
 * - `malformed: false` — **thymian's** limitation. It cannot reverse this
 *   style, so the value went unchecked. Reported as `info`; the request may be
 *   perfectly correct.
 * - `malformed: true` — the **request's** defect. thymian can reverse this
 *   style, and this value is not in it. Reported as an `assertion-failure`,
 *   because a value not serialized per its description does not conform to it.
 */
export interface UnsupportedSerialization {
  supported: false;
  style: Style;
  explode: boolean;
  malformed?: boolean;
}

export interface DeserializedParameter {
  supported: true;
  value: unknown;
}

export type DeserializeResult =
  DeserializedParameter | UnsupportedSerialization;

export function unsupported({
  style,
  explode,
}: SerializationStyle): UnsupportedSerialization {
  return { supported: false, style, explode };
}

/** The style is reversible; this particular value is not in it. */
export function malformed({
  style,
  explode,
}: SerializationStyle): UnsupportedSerialization {
  return { supported: false, style, explode, malformed: true };
}

export function deserialized(value: unknown): DeserializedParameter {
  return { supported: true, value };
}

/**
 * The message used wherever a parameter's declared style is one thymian cannot
 * deserialize. Reported as `info`, not a failure: the request may well be
 * correct — thymian simply did not check it — and blaming the request for a
 * tool limitation is the very defect this module exists to remove.
 */
export function unsupportedStyleMessage(
  subject: string,
  { style, explode }: UnsupportedSerialization,
): string {
  return `${subject} uses serialization style "${style}" (explode: ${explode}), which thymian cannot deserialize yet — it was not validated against its schema.`;
}

/**
 * The message for a value that is not serialized in the style its description
 * declares. Unlike `unsupportedStyleMessage` this is an assertion failure: the
 * description says how the value must be encoded, and it is not.
 */
export function malformedStyleMessage(
  subject: string,
  { style, explode }: UnsupportedSerialization,
): string {
  return `${subject} is not serialized in its declared style "${style}" (explode: ${explode}).`;
}
