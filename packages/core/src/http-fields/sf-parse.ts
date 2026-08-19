import type {
  BareItem,
  Dictionary,
  InnerList,
  Item,
  List,
  Parameters,
} from 'structured-headers';
import {
  DisplayString,
  parseDictionary,
  ParseError,
  parseItem,
  parseList,
  Token,
} from 'structured-headers';

import type { SfFieldType, SfHeaderRegistry } from './sf-fields.js';

// Re-exported so `rules-*` packages never need to import `structured-headers`
// directly -- `@thymian/core/http-fields` is the one seam. Value/grammar
// types are type-only; `Token`/`DisplayString` are runtime classes (used to
// *construct* Token/DisplayString bare items) and are re-exported as values.
export type { BareItem, Dictionary, InnerList, Item, List, Parameters };
export { DisplayString, Token };

/**
 * The outcome of {@link parseSfField}, discriminated so callers never need
 * to pattern-match on `message` text:
 *
 * - `ok: true` -- delegated parse succeeded; `value` is the typed SF result.
 * - `ok: false, refused: true` -- the guard fired: `name` is not registered
 *   as natively SF, so no parse was attempted.
 * - `ok: false, refused: false` -- `name` is registered, but the library's
 *   `ParseError` says the value is not valid SF grammar for its field type.
 */
export type SfParseResult =
  | { ok: true; fieldType: SfFieldType; value: Dictionary | List | Item }
  | { ok: false; refused: true; message: string }
  | { ok: false; refused: false; message: string };

/**
 * Parses `value` as the Structured Field named `name`, guarded by
 * `registry`.
 *
 * Allowlist-only: if `name` is registered, parsing is delegated fully to
 * `structured-headers`' `parseDictionary`/`parseList`/`parseItem` (no
 * pre-validation, no regex, no re-wrapping) -- if it is not registered
 * (explicitly including legacy headers like `Content-Security-Policy` or
 * `Set-Cookie`), the guard refuses before any parse is attempted, per RFC
 * 9651 §1: Structured Fields is opt-in per field, never assumed for a
 * field that hasn't declared itself as one.
 *
 * A registered header's same-name multiplicity must be combined before
 * parsing (RFC 9110 §5.2: repeated header instances are equivalent to one
 * comma-joined field-value). Pass either the already-joined `string` or the
 * raw `string[]` from `NormalizedHeaders.getAll()` -- an array is joined
 * with `", "` internally, so callers never need to do this themselves.
 */
export function parseSfField(
  registry: SfHeaderRegistry,
  name: string,
  value: string | readonly string[],
): SfParseResult {
  const fieldType = registry.fieldTypeOf(name);

  if (fieldType === undefined) {
    return {
      ok: false,
      refused: true,
      message:
        `"${name}" is not registered as a natively Structured Fields ` +
        'header (RFC 9651 §1: Structured Fields is opt-in per field, not ' +
        'retroactively assumed for a field that has not declared itself as ' +
        'one) -- refusing to parse.',
    };
  }

  const joined = Array.isArray(value) ? value.join(', ') : (value as string);

  try {
    switch (fieldType) {
      case 'dictionary':
        return { ok: true, fieldType, value: parseDictionary(joined) };
      case 'list':
        return { ok: true, fieldType, value: parseList(joined) };
      case 'item':
        return { ok: true, fieldType, value: parseItem(joined) };
      default:
        return fieldType satisfies never;
    }
  } catch (error) {
    if (error instanceof ParseError) {
      return { ok: false, refused: false, message: error.message };
    }

    throw error;
  }
}
