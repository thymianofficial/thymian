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
 * The one anchored pattern the grammar is expressed in. Methods are uppercase
 * (the canonical form), paths carry no whitespace, media types carry no
 * parentheses, and every separator is exactly one space.
 */
const SELECTOR_PATTERN =
  /^([A-Z0-9!#$%&'*+.^_|~-]+) (\S+)(?: \(([^()]+)\))? -> (\d+)(?: \(([^()]+)\))?$/;

/**
 * The same pattern with the method matched case-insensitively. Used only to
 * turn "you wrote the method in lowercase" into an actionable suggestion.
 */
const CASE_INSENSITIVE_SELECTOR_PATTERN = new RegExp(
  SELECTOR_PATTERN.source,
  'i',
);

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

  assertUnambiguous(selector, path, req.mediaType, res.mediaType);

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
    throw malformedSelectorError(value, lowercaseMethodHint(value));
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

function assertUnambiguous(
  selector: string,
  path: string,
  requestMediaType: string,
  responseMediaType: string,
): void {
  // Reachable: a traffic-derived `req.path` is taken verbatim off the wire and
  // may carry a query string or whitespace, unlike a spec-derived path. Such a
  // rendering cannot round-trip, so it fails loudly at catalog build rather
  // than becoming an unparseable key.
  if (/\s/.test(path)) {
    throw malformedSelectorError(selector, [
      `The request path "${path}" contains whitespace, which a selector cannot represent.`,
    ]);
  }

  if (path.includes('->')) {
    throw malformedSelectorError(selector, [
      `The request path "${path}" contains "->", which a selector uses as its separator.`,
    ]);
  }

  for (const mediaType of [requestMediaType, responseMediaType]) {
    if (mediaType.includes('(') || mediaType.includes(')')) {
      throw malformedSelectorError(selector, [
        `The media type "${mediaType}" contains a parenthesis, which a selector uses to delimit media types.`,
      ]);
    }
  }
}

function lowercaseMethodHint(value: string): string[] {
  const match = CASE_INSENSITIVE_SELECTOR_PATTERN.exec(value);
  const method = match?.[1];

  if (!method) {
    return [];
  }

  return [
    `A selector spells its method in uppercase. Did you mean "${method.toUpperCase()}${value.slice(
      method.length,
    )}"?`,
  ];
}
