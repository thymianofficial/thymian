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
 * The grammar relaxed on exactly the two axes a hand-authored selector slips on
 * — method case and the leading slash — plus leading zeros in the status. Used
 * ONLY to turn a rejection into a "did you mean …?" suggestion; it never
 * decides whether a selector is valid.
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

  assertUnambiguous(selector, {
    method,
    path,
    status,
    requestMediaType: req.mediaType,
    responseMediaType: res.mediaType,
  });

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

function assertUnambiguous(selector: string, parts: RenderedParts): void {
  // Reachable: a traffic-derived `req.path` is taken verbatim off the wire and
  // may carry a query string or whitespace, unlike a spec-derived path. Such a
  // rendering cannot round-trip, so it fails loudly at catalog build rather
  // than becoming an unparseable key.
  if (/\s/.test(parts.path)) {
    throw malformedSelectorError(selector, [
      `The request path "${parts.path}" contains whitespace, which a selector cannot represent.`,
    ]);
  }

  if (parts.path.includes('->')) {
    throw malformedSelectorError(selector, [
      `The request path "${parts.path}" contains "->", which a selector uses as its separator.`,
    ]);
  }

  for (const mediaType of [parts.requestMediaType, parts.responseMediaType]) {
    if (mediaType.includes('(') || mediaType.includes(')')) {
      throw malformedSelectorError(selector, [
        `The media type "${mediaType}" contains a parenthesis, which a selector uses to delimit media types.`,
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
      `Check its method ("${parts.method}") and its status ("${parts.status}") — a status must be a non-negative integer without leading zeros.`,
    ]);
  }
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

  const requestMedia = match[3] ? ` (${match[3]})` : '';
  const responseMedia = match[5] ? ` (${match[5]})` : '';
  const canonical = `${method.toUpperCase()} ${selectorPath(
    path,
  )}${requestMedia} -> ${Number(status)}${responseMedia}`;

  if (canonical === value || !SELECTOR_PATTERN.test(canonical)) {
    return [];
  }

  return [
    `A selector spells its method in uppercase and its path with a leading "/". Did you mean "${canonical}"?`,
  ];
}
