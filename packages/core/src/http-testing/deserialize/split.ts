/**
 * Delimiter splitting.
 *
 * Splitting runs on the still-ENCODED wire form and decodes each item after,
 * so an escaped delimiter (`a%2Cb`) stays one item. Header lists additionally
 * follow RFC 9110 §5.6.1: a comma inside a quoted-string is data, optional
 * whitespace is trimmed, and empty members are ignored.
 */

/**
 * Field values RFC 9110 §5.3 exempts from comma-folding: their grammar allows
 * a bare comma, so combining or splitting them on one corrupts the value.
 */
export const NON_LIST_HEADERS = new Set(['set-cookie']);

export function splitHeaderList(raw: string): string[] {
  const items: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of raw) {
    // Quote state only suppresses the DELIMITER. Every character is still
    // appended: members reach the schema exactly as they arrived, so an
    // `items` `pattern`/`enum` written against the wire form of a quoted
    // entity-tag still matches, and `maxLength` counts what was sent.
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (quoted && char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }

    if (char === ',' && !quoted) {
      items.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  // An unbalanced quote means the value is not a well-formed quoted-string, so
  // the quote-awareness was reading the wrong grammar. Fall back to a plain
  // split rather than silently treating every later comma as data.
  if (quoted) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  }

  items.push(current);

  return items.map((item) => item.trim()).filter((item) => item !== '');
}

/**
 * Split a still-encoded wire value on a delimiter, then decode each item.
 * Splitting before decoding is what keeps `a%2Cb` one item rather than two.
 * `trim` drops the optional whitespace RFC 9110 §5.6.1 permits in header lists.
 */
export function splitWireList(
  raw: string,
  decode: (item: string) => string,
  {
    trim = false,
    delimiter = ',',
  }: { trim?: boolean; delimiter?: string } = {},
): string[] {
  if (raw === '') {
    return [];
  }

  return raw.split(delimiter).map((item) => decode(trim ? item.trim() : item));
}
