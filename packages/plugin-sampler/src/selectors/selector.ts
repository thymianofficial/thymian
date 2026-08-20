import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';

import {
  describeRenderedTransaction,
  malformedSelectorError,
} from './selector-errors.js';

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
 * A selector names exactly one transaction. It is host-stripped, media-typed
 * and ASCII — deliberately *not* core's display string
 * (`GET /launches - application/json → 200 OK - application/json`), which is a
 * near-twin used for report locations, rule headings and test-case names.
 *
 * This is a documentation alias only. The typed union
 * (`Selector = keyof Endpoints`) is generated separately; branding the runtime
 * type here would have to be undone later.
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
 * The one anchored pattern the grammar is expressed in, and the single source of
 * truth for what a selector *is*: `formatSelector` asserts its own output
 * against it, and `parseSelector` accepts nothing else. Keeping the two
 * languages identical is what makes the catalog a bijection.
 *
 * Methods are an uppercased RFC 9110 §5.6.2 `tchar` token (the canonical form),
 * paths carry no whitespace and begin with `/` — exactly as `selectorPath`
 * renders them — statuses carry no leading zeros because `String(number)` never
 * emits one, media types carry no parentheses, and every separator is exactly
 * one space.
 */
const SELECTOR_PATTERN =
  /^([A-Z0-9!#$%&'*+.^_`|~-]+) (\/\S*)(?: \(([^()]+)\))? -> (0|[1-9]\d*)(?: \(([^()]+)\))?$/;

/**
 * The grammar relaxed on exactly the three axes a hand-authored selector slips
 * on — method case, the leading slash, and a zero-padded status. Used ONLY to
 * turn a rejection into a "did you mean …?" suggestion; it never decides whether
 * a selector is valid.
 *
 * The path group stays lenient about the leading slash because that is the slip
 * this pattern exists for, which means the hint — not the grammar — has to be
 * the thing that refuses to invent a path out of something that is not one; see
 * {@link canonicalizablePath}.
 */
const LENIENT_SELECTOR_PATTERN =
  /^([A-Za-z0-9!#$%&'*+.^_`|~-]+) (\S+)(?: \(([^()]+)\))? -> (\d+)(?: \(([^()]+)\))?$/;

/**
 * The only normalization a selector path receives: the leading slash
 * `thymianHttpRequestToUrl` also guarantees, because `req.path` is not
 * guaranteed to start with one. Nothing else is applied — the OpenAPI server
 * basePath, a trailing slash, percent-encoding and a traffic-derived query
 * string all stay exactly as the format carries them.
 */
export function selectorPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Renders one `(request, response)` pair as its selector. This is the only code
 * path that produces a selector string.
 */
export function formatSelector(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
): Selector {
  const method = req.method.toUpperCase();
  const path = selectorPath(req.path);
  const status = String(res.statusCode);

  // Media type — not body/schema presence — is what makes a transaction
  // distinct. `mediaType` is a non-optional string whose `''` means "none", so
  // a `content:` entry that declares a media type but no schema still gets its
  // own selector.
  const requestMedia = req.mediaType ? ` (${req.mediaType})` : '';
  const responseMedia = res.mediaType ? ` (${res.mediaType})` : '';

  const selector = `${method} ${path}${requestMedia} -> ${status}${responseMedia}`;

  assertUnambiguous(
    selector,
    {
      method,
      path,
      status,
      requestMediaType: req.mediaType,
      responseMediaType: res.mediaType,
    },
    req,
    res,
  );

  return selector;
}

/** Thin wrapper over {@link formatSelector} for a whole transaction. */
export function selectorForTransaction(
  transaction: ThymianHttpTransaction,
): Selector {
  return formatSelector(transaction.thymianReq, transaction.thymianRes);
}

/**
 * Parses a selector back into its components.
 *
 * This exists for DIAGNOSTICS ONLY. Resolution is a map lookup
 * (`TransactionCatalog.resolve`) and parses only after a miss, to build the
 * error. Do not move a parse onto the happy path.
 */
export function parseSelector(value: string): SelectorParts {
  const match = SELECTOR_PATTERN.exec(value);

  if (!match) {
    throw malformedSelectorError(value, canonicalFormHint(value));
  }

  const method = match[1];
  const path = match[2];
  const status = match[4];

  // `noUncheckedIndexedAccess` types every group as possibly-undefined even
  // though groups 1, 2 and 4 are mandatory in the pattern. Narrow rather than
  // assert.
  if (method === undefined || path === undefined || status === undefined) {
    throw malformedSelectorError(value);
  }

  return {
    method,
    path,
    requestMediaType: match[3],
    status: Number(status),
    responseMediaType: match[5],
  };
}

type RenderedParts = {
  method: string;
  path: string;
  status: string;
  requestMediaType: string;
  responseMediaType: string;
};

/**
 * The two components `assertUnambiguous`'s path and media-type checks do not
 * cover, spelled out separately so its backstop can name the one that is
 * actually at fault instead of lecturing about both.
 */
const METHOD_PATTERN = /^[A-Z0-9!#$%&'*+.^_`|~-]+$/;
const STATUS_PATTERN = /^(0|[1-9]\d*)$/;

function assertUnambiguous(
  selector: string,
  parts: RenderedParts,
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
): void {
  // Reachable: a traffic-derived `req.path` is taken verbatim off the wire and
  // may carry a query string or whitespace, unlike a spec-derived path. Such a
  // rendering cannot round-trip, so it fails loudly at catalog build rather
  // than becoming an unparseable key.
  //
  // Every throw below aborts the whole format load, and every reachable trigger
  // is a value the user never typed as a selector, so each one names the source
  // and location of the transaction that could not be rendered — the same
  // pointer `SelectorCollisionError` gives for both sides of a collision.
  if (/\s/.test(parts.path)) {
    throw malformedSelectorError(selector, [
      `The request path "${parts.path}" contains whitespace, which a selector cannot represent.`,
      describeRenderedTransaction(req, res),
    ]);
  }

  if (parts.path.includes('->')) {
    throw malformedSelectorError(selector, [
      `The request path "${parts.path}" contains "->", which a selector uses as its separator.`,
      describeRenderedTransaction(req, res),
    ]);
  }

  for (const mediaType of [parts.requestMediaType, parts.responseMediaType]) {
    if (mediaType.includes('(') || mediaType.includes(')')) {
      throw malformedSelectorError(selector, [
        `The media type "${mediaType}" contains a parenthesis, which a selector uses to delimit media types.`,
        describeRenderedTransaction(req, res),
      ]);
    }
  }

  // The backstop the three checks above cannot provide: the rendering is only a
  // selector if the grammar accepts it back. Without this, an out-of-grammar
  // METHOD or status silently becomes a catalog key that `parseSelector`
  // rejects, and the bijection this file advertises is false. Reachable today
  // through the status: `responses-object.processor.ts` guards a response key
  // with `n < 100 || n > 599`, and both comparisons are `false` for `NaN`, so a
  // non-numeric key yields `statusCode: NaN` and a `-> NaN` rendering.
  if (!SELECTOR_PATTERN.test(selector)) {
    throw malformedSelectorError(selector, [
      `The transaction renders as "${selector}", which the selector grammar cannot represent.`,
      ...renderingFaults(parts),
      describeRenderedTransaction(req, res),
    ]);
  }
}

/**
 * Names the component that is out of grammar. The path and the media types are
 * excluded by the checks above, so only the method and the status are left — but
 * naming both unconditionally told a user whose method was `GE T` that "a status
 * must be a non-negative integer", about a status that was already fine.
 */
function renderingFaults(parts: RenderedParts): string[] {
  const faults: string[] = [];

  if (!METHOD_PATTERN.test(parts.method)) {
    faults.push(
      `Check its method ("${parts.method}") — a method is one or more RFC 9110 §5.6.2 tchar characters and carries no whitespace.`,
    );
  }

  if (!STATUS_PATTERN.test(parts.status)) {
    faults.push(
      `Check its status ("${parts.status}") — a status must be a non-negative integer without leading zeros.`,
    );
  }

  // Unreachable while the grammar has exactly these five components; kept so
  // that adding a sixth cannot produce a hint-less abort.
  if (faults.length === 0) {
    faults.push(
      `Check its method ("${parts.method}") and its status ("${parts.status}") against the grammar below.`,
    );
  }

  return faults;
}

/**
 * Whether prepending the missing leading slash would be a correction rather than
 * an invention. `selectorPath` prepends unconditionally and `SELECTOR_PATTERN`
 * accepts the result, so without this the hint manufactures paths: a pasted URL
 * becomes `/https://api.example.com/launches`, and an input that omitted the
 * path entirely promotes its media type into the path slot,
 * `/(application/json)`. A `":"` is a scheme or an authority port and a leading
 * `"("` is a media type; neither is a path that lost its slash.
 */
function canonicalizablePath(path: string): boolean {
  return path.startsWith('/') || !(path.includes(':') || path.startsWith('('));
}

/**
 * Strips a status's zero padding, but only when what is left is a status code —
 * three digits, per RFC 9110 §15. `Number(status)` reinterpreted instead of
 * canonicalizing: it turned `007` into `7` and `0000` into `0`, suggesting
 * selectors no transaction can carry. A status that cannot be canonicalized is
 * returned unchanged, so the hint still corrects the method or the path.
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

/**
 * States only the corrections the hint actually made. The sentence used to
 * hardcode method case and the leading slash for all three normalizations, so
 * `GET /x -> 0200` was answered with advice about two things that were already
 * right.
 */
function describeNormalizations(
  method: string,
  path: string,
  status: string,
): string {
  const rules: string[] = [];

  if (method !== method.toUpperCase()) {
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
  const match = LENIENT_SELECTOR_PATTERN.exec(value);

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
  const canonical = `${method.toUpperCase()} ${selectorPath(
    path,
  )}${requestMedia} -> ${canonicalStatus(status)}${responseMedia}`;

  if (canonical === value || !SELECTOR_PATTERN.test(canonical)) {
    return [];
  }

  return [
    `${describeNormalizations(method, path, status)}Did you mean "${canonical}"?`,
  ];
}
