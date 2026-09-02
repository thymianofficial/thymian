import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';

import { malformedSelectorError } from './selector-errors.js';

/**
 * A fully-qualified transaction selector:
 *
 * ```
 * METHOD SP path [ SP "(" reqMediaType ")" ] SP "->" SP status [ SP "(" resMediaType ")" ]
 * ```
 *
 * ```
 * GET /launches -> 200 (application/json)
 * POST /astronauts (application/json) -> 201 (application/json)
 * DELETE /astronauts/{id} -> 204
 * ```
 *
 * A selector names exactly one Transaction. It is host-stripped, media-typed and
 * ASCII — deliberately *not* core's display string
 * (`GET /launches - application/json → 200 OK - application/json`), which is a
 * near-twin used for report locations, rule headings and test-case names.
 *
 * This is a documentation alias only. The typed union (`Selector =
 * keyof Endpoints`) is generated from the catalog, so branding the runtime type
 * here would have to be undone later.
 */
export type Selector = string;

export type SelectorParts = {
  method: string;
  path: string;
  requestMediaType?: string;
  status: number;
  responseMediaType?: string;
};

/**
 * RFC 9110 §5.6.2 `tchar`, the character set a method is written in. `%` is a
 * tchar, which is what lets {@link encodeMethod} stay inside the set while
 * escaping anything outside it.
 */
const TCHAR = /^[A-Za-z0-9!#$%&'*+.^_`|~-]$/;

/**
 * The anchored grammar, and the single source of truth for what a selector *is*:
 * every rendered selector round-trips through it, and {@link parseSelector}
 * accepts nothing else.
 *
 * Three groups are looser than the canonical rendering, deliberately:
 *
 * - the **path** group forbids whitespace only, because {@link encodePath}
 *   escapes whitespace and `>` and leaves every other character — parentheses
 *   included — exactly as the description carries it;
 * - the **status** group is a token rather than digits, so a description that
 *   declared a non-numeric response key still renders instead of aborting the
 *   load (`plugin-openapi` guards a response key with `n < 100 || n > 599`, and
 *   both comparisons are `false` for `NaN`, so such a key arrives as
 *   `statusCode: NaN` and renders as `NaN`);
 * - the **media** groups are matched by {@link scanMediaGroup} rather than by
 *   this pattern's `[^()]*`, because a quoted-string parameter may legally
 *   contain a parenthesis.
 *
 * The pattern is therefore the shape test; {@link splitSelector} does the
 * quote-aware slicing.
 */
const SELECTOR_SHAPE =
  /^([A-Za-z0-9!#$%&'*+.^_`|~-]+) (\/\S*)(?: \(.*\))? -> ([^\s()]+)(?: \(.*\))?$/;

const UPPERCASE_METHOD = /^[A-Z0-9!#$%&'*+.^_`|~-]+$/;

/**
 * Percent-encodes one character, uppercase-hex, as a URI would.
 *
 * Multi-byte characters are encoded per UTF-8 byte, which is what
 * `encodeURIComponent` does and what a server would receive.
 */
function percentEncode(char: string): string {
  return [...new TextEncoder().encode(char)]
    .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('');
}

/**
 * The path as a selector spells it.
 *
 * Two transformations, and no others:
 *
 * 1. the leading `/` that `req.path` is not guaranteed to carry;
 * 2. percent-encoding of the characters that would collide with the grammar —
 *    whitespace, which separates the components, and `>`, whose only role in a
 *    path would be to complete the `->` separator. Both are characters a URI
 *    must percent-encode anyway, so escaping them is the faithful rendering of a
 *    path that carried them raw.
 *
 * Everything else is left alone: the OpenAPI server base path, a trailing slash,
 * existing percent-encoding, `{`/`}` template braces, and parentheses.
 *
 * Encoding rather than rejecting is what makes rendering total — no legal
 * description can abort catalog construction. It is not, strictly, injective
 * over all inputs: a description declaring both `/a b` and `/a%20b` renders one
 * string for two transactions, because raw and encoded forms cannot be told
 * apart after encoding without double-encoding every ordinary path. That residue
 * is caught, not ignored — the catalog reports it as a selector collision naming
 * both sides and where they came from, which is the same treatment a genuine
 * duplicate gets.
 */
export function encodePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;

  return [...withSlash]
    .map((char) =>
      /\s/.test(char) || char === '>' ? percentEncode(char) : char,
    )
    .join('');
}

/**
 * The method as a selector spells it: uppercased, with anything outside `tchar`
 * percent-encoded. A method is a token by RFC 9110, so a character outside the
 * set only arrives from a description that put it there, and escaping keeps that
 * transaction addressable instead of unrepresentable.
 */
export function encodeMethod(method: string): string {
  return [...method.toUpperCase()]
    .map((char) => (TCHAR.test(char) ? char : percentEncode(char)))
    .join('');
}

/**
 * The media type as a selector spells it.
 *
 * Rendered RFC-9110-faithfully — parameters, spacing and quoted strings survive
 * verbatim, including a parenthesis inside a quoted string, which the
 * parenthesized media group delimits with quote awareness rather than by
 * counting characters.
 *
 * The one escape is a parenthesis *outside* a quoted string. An unquoted
 * parameter value is a token and a token has no parentheses, so a bare
 * parenthesis is already not RFC-9110-legal; percent-encoding it keeps the
 * media group's delimiters unambiguous without rejecting the transaction.
 */
export function encodeMediaType(mediaType: string): string {
  let out = '';
  let inQuotes = false;

  for (let i = 0; i < mediaType.length; i++) {
    const char = mediaType[i] as string;

    if (inQuotes && char === '\\' && i + 1 < mediaType.length) {
      out += char + (mediaType[i + 1] as string);
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      out += char;
      continue;
    }

    out +=
      !inQuotes && (char === '(' || char === ')') ? percentEncode(char) : char;
  }

  return out;
}

/**
 * Renders one `(request, response)` pair as its selector. The only code path
 * that produces a selector string.
 *
 * Media parts appear whenever the node **declares** a media type — not only when
 * it carries a body. `mediaType` is a non-optional string whose `''` means
 * "none", so a `content:` entry that declares a media type but no schema still
 * gets its own selector and its own media part.
 */
export function formatSelector(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
): Selector {
  const method = encodeMethod(req.method);
  const path = encodePath(req.path);
  const status = String(res.statusCode);
  const requestMedia = req.mediaType
    ? ` (${encodeMediaType(req.mediaType)})`
    : '';
  const responseMedia = res.mediaType
    ? ` (${encodeMediaType(res.mediaType)})`
    : '';

  return `${method} ${path}${requestMedia} -> ${status}${responseMedia}`;
}

/** {@link formatSelector} for a whole transaction. */
export function selectorForTransaction(
  transaction: ThymianHttpTransaction,
): Selector {
  return formatSelector(transaction.thymianReq, transaction.thymianRes);
}

/**
 * Total order on selectors, by UTF-16 code unit.
 *
 * Deliberately not `localeCompare`: the catalog's order is the order of the
 * generated type surface, and a locale-sensitive comparison would make the
 * committed types depend on the machine that generated them.
 */
export function compareSelectors(a: Selector, b: Selector): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Reads a selector's parenthesized media group starting at `open`, respecting
 * quoted strings, and answers where it ends.
 *
 * Returns `undefined` when the group is unterminated, which makes the value a
 * malformed selector rather than a group that silently swallows the rest.
 */
function scanMediaGroup(
  value: string,
  open: number,
): { content: string; end: number } | undefined {
  let inQuotes = false;

  for (let i = open + 1; i < value.length; i++) {
    const char = value[i] as string;

    if (inQuotes && char === '\\' && i + 1 < value.length) {
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ')') {
      return { content: value.slice(open + 1, i), end: i };
    }
  }

  return undefined;
}

/**
 * Splits a selector into its five components with quote-aware media groups.
 *
 * Returns `undefined` for anything that is not a selector; the caller decides
 * whether that is a diagnostic or a hint attempt.
 */
function splitSelector(value: string): SelectorParts | undefined {
  if (!SELECTOR_SHAPE.test(value)) {
    return undefined;
  }

  const firstSpace = value.indexOf(' ');
  const method = value.slice(0, firstSpace);
  let rest = value.slice(firstSpace + 1);

  // The path runs to the next space, because `encodePath` leaves none inside it.
  const pathEnd = rest.indexOf(' ');

  if (pathEnd === -1) {
    return undefined;
  }

  const path = rest.slice(0, pathEnd);
  rest = rest.slice(pathEnd + 1);

  let requestMediaType: string | undefined;

  if (rest.startsWith('(')) {
    const group = scanMediaGroup(rest, 0);

    if (!group) {
      return undefined;
    }

    requestMediaType = group.content;
    rest = rest.slice(group.end + 1);

    if (!rest.startsWith(' ')) {
      return undefined;
    }

    rest = rest.slice(1);
  }

  if (!rest.startsWith('-> ')) {
    return undefined;
  }

  rest = rest.slice(3);

  const statusEnd = rest.indexOf(' ');
  const status = statusEnd === -1 ? rest : rest.slice(0, statusEnd);

  if (status.length === 0) {
    return undefined;
  }

  let responseMediaType: string | undefined;

  if (statusEnd !== -1) {
    rest = rest.slice(statusEnd + 1);

    if (!rest.startsWith('(')) {
      return undefined;
    }

    const group = scanMediaGroup(rest, 0);

    if (!group || group.end !== rest.length - 1) {
      return undefined;
    }

    responseMediaType = group.content;
  }

  return {
    method,
    path,
    requestMediaType,
    status: Number(status),
    responseMediaType,
  };
}

/**
 * Parses a selector back into its components.
 *
 * For DIAGNOSTICS ONLY. Resolution is a map lookup
 * (`TransactionCatalog.resolve`); a parse happens only after a miss, to decide
 * whether the value was malformed or merely unknown. Do not move a parse onto
 * the happy path.
 */
export function parseSelector(value: string): SelectorParts {
  const parts = splitSelector(value);

  if (!parts) {
    throw malformedSelectorError(value, canonicalFormHint(value));
  }

  return parts;
}

/** Whether `value` is a syntactically well-formed selector. */
export function isSelector(value: string): boolean {
  return splitSelector(value) !== undefined;
}

/**
 * The grammar relaxed on exactly the three axes a hand-authored selector slips
 * on — method case, the leading slash, and a zero-padded status. Used ONLY to
 * turn a rejection into a "did you mean …?" suggestion; it never decides whether
 * a selector is valid.
 */
const LENIENT_SHAPE =
  /^([A-Za-z0-9!#$%&'*+.^_`|~-]+) (\S+)(?: \((.*)\))? -> (\d+)(?: \((.*)\))?$/;

/**
 * Whether prepending the missing leading slash would be a correction rather than
 * an invention. Without this the hint manufactures paths out of URLs.
 *
 * A path that merely lost its slash begins with a path *segment*, so the
 * judgement is made on the first segment alone: a `:` there is a scheme or an
 * authority port, a `.` there is a host label or a relative-path marker, and a
 * leading `(`, `?` or `#` is a media type, query string or fragment promoted
 * into the path slot. Judging only the first segment keeps a legal slash-less
 * path such as `users/{id}:activate` eligible.
 */
function canonicalizablePath(path: string): boolean {
  if (path.startsWith('/')) {
    return true;
  }

  if (/^[(?#]/.test(path)) {
    return false;
  }

  const firstSegment = path.split('/', 1)[0] ?? path;

  return !(firstSegment.includes(':') || firstSegment.includes('.'));
}

/**
 * Strips a status's zero padding, but only when what is left is a status code —
 * three digits, per RFC 9110 §15. Reinterpreting through `Number` instead would
 * turn `007` into `7`, suggesting a selector no transaction can carry.
 */
function canonicalStatus(status: string): string {
  const stripped = status.replace(/^0+/, '');

  return /^[1-9]\d\d$/.test(stripped) ? stripped : status;
}

function joinWithAnd(items: string[]): string {
  if (items.length < 2) {
    return items.join('');
  }

  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** States only the corrections the hint actually made. */
function describeNormalizations(
  method: string,
  path: string,
  status: string,
): string {
  const rules: string[] = [];

  if (!UPPERCASE_METHOD.test(method)) {
    rules.push('spells its method in uppercase');
  }

  if (!path.startsWith('/')) {
    rules.push('spells its path with a leading "/"');
  }

  if (canonicalStatus(status) !== status) {
    rules.push('spells its status without leading zeros');
  }

  return rules.length > 0 ? `A selector ${joinWithAnd(rules)}. ` : '';
}

/**
 * Suggests the canonical spelling of a value that is *nearly* a selector:
 * lowercase method, missing leading slash, zero-padded status. Returns nothing
 * when the value is not recognizable or already canonical.
 */
function canonicalFormHint(value: string): string[] {
  const match = LENIENT_SHAPE.exec(value);

  if (!match) {
    return [];
  }

  const method = match[1];
  const path = match[2];
  const status = match[4];

  if (method === undefined || path === undefined || status === undefined) {
    return [];
  }

  if (!canonicalizablePath(path)) {
    return [];
  }

  const requestMedia = match[3] ? ` (${match[3]})` : '';
  const responseMedia = match[5] ? ` (${match[5]})` : '';
  const canonical = `${method.toUpperCase()} ${encodePath(
    path,
  )}${requestMedia} -> ${canonicalStatus(status)}${responseMedia}`;

  if (canonical === value || !isSelector(canonical)) {
    return [];
  }

  return [
    `${describeNormalizations(method, path, status)}Did you mean "${canonical}"?`,
  ];
}
