import {
  canonicalPath,
  encodeMediaType,
  encodeMethod,
  encodePath,
  formatRequestSelector,
  formatResponseSelector,
  formatSelector,
  type Selector,
  SELECTOR_METHOD_CHARS,
  selectorForTransaction,
} from '@thymian/core';

import { malformedSelectorError } from './selector-errors.js';

/**
 * The selector grammar, plugin side: everything that reads a selector.
 *
 * **Rendering lives in `@thymian/core`** (`selector/render-selector.ts`) and is
 * re-exported here, because a selector is two things at once — the sampler's
 * *address* of a Transaction and the application's *label* for one — and every
 * surface core prints has to render the same grammar the sampler resolves
 * (ADR-0020). What stays here is what only an address needs: parsing back,
 * near-miss diagnostics and the catalog's ordering.
 *
 * The reader below is the inverse of core's encoders. The two are one grammar
 * split across two packages, so the round-trip property — every rendered
 * selector parses, and parses back to what it was rendered from — is the test
 * that keeps them honest.
 */
export {
  canonicalPath,
  encodeMediaType,
  encodeMethod,
  encodePath,
  formatRequestSelector,
  formatResponseSelector,
  formatSelector,
  type Selector,
  selectorForTransaction,
};

export type SelectorParts = {
  method: string;
  path: string;
  requestMediaType?: string;
  status: number;
  responseMediaType?: string;
};

const METHOD_TOKEN = new RegExp(`^[${SELECTOR_METHOD_CHARS}]+$`);
const UPPERCASE_METHOD = new RegExp(`^[A-Z0-9!#$%&'*+.^_\`|~-]+$`);

/** Reads a quoted component starting at `open`, and says where it ended. */
function readQuoted(
  value: string,
  open: number,
): { content: string; end: number } | undefined {
  let content = '';

  for (let i = open + 1; i < value.length; i++) {
    const char = value[i] as string;

    if (char === '\\') {
      const next = value[i + 1];

      if (next === undefined) {
        return undefined;
      }

      content += next;
      i++;

      continue;
    }

    if (char === '"') {
      return { content, end: i };
    }

    content += char;
  }

  return undefined;
}

/**
 * Reads a media group starting at the `(` at `open`, and says where it ended.
 *
 * The inverse of core's media-type encoder: outside a quoted string a `\`
 * escapes the next character and is dropped, a `"` opens quote state, and the
 * first unescaped, unquoted `)` ends the group. Inside a quoted string
 * everything is carried through, quoted-pairs included, because that text is
 * the media type's own.
 */
function readMediaGroup(
  value: string,
  open: number,
): { content: string; end: number } | undefined {
  let content = '';
  let inQuotes = false;

  for (let i = open + 1; i < value.length; i++) {
    const char = value[i] as string;

    if (inQuotes) {
      if (char === '\\' && i + 1 < value.length) {
        content += char + (value[i + 1] as string);
        i++;

        continue;
      }

      if (char === '"') {
        inQuotes = false;
      }

      content += char;

      continue;
    }

    if (char === '\\') {
      const next = value[i + 1];

      if (next === undefined) {
        return undefined;
      }

      content += next;
      i++;

      continue;
    }

    if (char === '"') {
      inQuotes = true;
      content += char;

      continue;
    }

    if (char === ')') {
      return { content, end: i };
    }

    content += char;
  }

  return undefined;
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
 * Splits a selector into its five components.
 *
 * This hand-written reader is the **only** description of the grammar's read
 * direction. An equivalent regex used to sit beside it as a shape test, and the
 * two disagreed: a media type containing a newline rendered into a selector the
 * regex rejected, because `.` excludes line terminators. One grammar, one
 * reader.
 *
 * Returns `undefined` for anything that is not a selector; the caller decides
 * whether that is a diagnostic or a hint attempt.
 */
function splitSelector(value: string): SelectorParts | undefined {
  let at = 0;

  const method = readComponent(value, at);

  if (!method) {
    return undefined;
  }

  if (!method.quoted && !METHOD_TOKEN.test(method.content)) {
    return undefined;
  }

  at = method.end;

  if (value[at] !== ' ') {
    return undefined;
  }

  at += 1;

  const path = readComponent(value, at);

  if (!path || !path.content.startsWith('/')) {
    return undefined;
  }

  at = path.end;

  let requestMediaType: string | undefined;

  if (value.startsWith(' (', at)) {
    const group = readMediaGroup(value, at + 1);

    if (!group) {
      return undefined;
    }

    requestMediaType = group.content;
    at = group.end + 1;
  }

  if (!value.startsWith(' -> ', at)) {
    return undefined;
  }

  at += 4;

  const statusEnd = value.indexOf(' ', at);
  const status = value.slice(at, statusEnd === -1 ? undefined : statusEnd);

  if (status.length === 0 || /[\s()]/.test(status)) {
    return undefined;
  }

  let responseMediaType: string | undefined;

  if (statusEnd !== -1) {
    at = statusEnd;

    if (!value.startsWith(' (', at)) {
      return undefined;
    }

    const group = readMediaGroup(value, at + 1);

    if (!group || group.end !== value.length - 1) {
      return undefined;
    }

    responseMediaType = group.content;
  }

  return {
    method: method.content,
    path: path.content,
    requestMediaType,
    status: Number(status),
    responseMediaType,
  };
}

/**
 * Reads a method or path: a quoted string when it begins with `"`, otherwise the
 * run of characters up to the next space.
 */
function readComponent(
  value: string,
  at: number,
): { content: string; end: number; quoted: boolean } | undefined {
  if (at >= value.length) {
    return undefined;
  }

  if (value[at] === '"') {
    const read = readQuoted(value, at);

    return read
      ? { content: read.content, end: read.end + 1, quoted: true }
      : undefined;
  }

  const space = value.indexOf(' ', at);
  const end = space === -1 ? value.length : space;
  const content = value.slice(at, end);

  return content.length > 0 ? { content, end, quoted: false } : undefined;
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
const LENIENT_SHAPE = new RegExp(
  `^([${SELECTOR_METHOD_CHARS}]+) (\\S+)(?: \\(([^()]*)\\))? -> (\\d+)(?: \\(([^()]*)\\))?$`,
);

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
