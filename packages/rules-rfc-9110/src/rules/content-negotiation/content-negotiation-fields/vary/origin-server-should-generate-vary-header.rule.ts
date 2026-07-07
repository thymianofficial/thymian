import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  getHeader,
  type HttpRequest,
  type HttpResponse,
  method,
  or,
  requestHeader,
  type RuleFnResult,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

/**
 * Request header fields whose presence indicates that the origin server was
 * given preferences it could use to tailor (proactively negotiate) the
 * response. When a response is selected based on any of these and is cacheable,
 * the absence of a `Vary` header makes the response a cache-poisoning hazard:
 * a shared cache may reuse it for a later request that expressed different
 * preferences.
 */
const negotiationRequestHeaders = [
  'accept',
  'accept-language',
  'accept-encoding',
  'accept-charset',
];

/**
 * Status codes that are at least heuristically cacheable per RFC 9111
 * Section 4.2.2, so a stored response could later be reused.
 */
const cacheableStatusCodes = [
  200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501,
];

/**
 * The transactions this rule targets: a safe, cacheable method returning a
 * (heuristically) cacheable status code for a request that expressed
 * proactive-negotiation preferences, so the response was likely tailored to
 * them.
 */
const negotiatedCacheableResponse = and(
  or(method('GET'), method('HEAD')),
  or(...cacheableStatusCodes.map((code) => statusCode(code))),
  or(...negotiationRequestHeaders.map((header) => requestHeader(header))),
);

function hasHeader(headers: string[], name: string): boolean {
  return headers.some((header) => header.toLowerCase() === name);
}

/** Negotiation headers present in a common (design-time) request projection. */
function presentNegotiationHeaders(req: CommonHttpRequest): string[] {
  return negotiationRequestHeaders.filter((header) =>
    hasHeader(req.headers, header),
  );
}

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(',') : value;
}

/** The field-names listed in a `Vary` value, lower-cased. */
function parseVary(value: string): string[] {
  return value
    .split(',')
    .map((field) => field.trim().toLowerCase())
    .filter((field) => field.length > 0);
}

/**
 * Value-based check shared by the test and analytics contexts, where the real
 * request/response headers (with values) are available. Beyond presence, it
 * verifies that a `Vary` header actually covers a negotiation dimension that
 * the request exercised — a `Vary` listing none of the negotiated headers
 * leaves that dimension unprotected against cache reuse.
 */
function validateVaryValue(
  req: HttpRequest,
  res: HttpResponse,
  location: RuleViolationLocation,
): RuleFnResult[] {
  const presentHeaders = negotiationRequestHeaders.filter(
    (header) => getHeader(req.headers, header) !== undefined,
  );

  const varyValue = headerToString(getHeader(res.headers, 'vary'));

  if (!varyValue || !varyValue.trim()) {
    return [
      {
        location,
        violation: {
          message: `Response SHOULD contain Vary header with values: ${createList(presentHeaders)}.`,
        },
        findings: [],
      },
    ];
  }

  const varyFields = parseVary(varyValue);

  // `Vary: *` varies on everything, so every negotiated dimension is covered.
  if (varyFields.includes('*')) {
    return [];
  }

  if (presentHeaders.some((header) => varyFields.includes(header))) {
    return [];
  }

  return [
    {
      location,
      violation: {
        message: `Response Vary header (${varyValue.trim()}) SHOULD contain at least one of the negotiated values: ${createList(presentHeaders)}.`,
      },
      findings: [],
    },
  ];
}

export default httpRule('rfc9110/origin-server-should-generate-vary-header')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-vary')
  .description(
    "An origin server SHOULD generate a Vary header field on a cacheable response when it wishes that response to be selectively reused for subsequent requests. Generally, that is the case when the response content has been tailored to better fit the preferences expressed by those selecting header fields, such as when an origin server has selected the response's language based on the request's Accept-Language header field.",
  )
  .summary(
    'An origin server SHOULD generate a Vary header field on a cacheable response when it wishes that response to be selectively reused for subsequent requests.',
  )
  .appliesTo('origin server')
  // Static context sees only header names (no values), so it can only check
  // that a `Vary` header is present when a negotiation request header is.
  .overrideStaticRule((ctx) =>
    ctx.validateCommonHttpTransactions(
      negotiatedCacheableResponse,
      (
        req: CommonHttpRequest,
        res: CommonHttpResponse,
        location: RuleViolationLocation,
      ) => {
        if (hasHeader(res.headers, 'vary')) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `Response SHOULD contain Vary header with values: ${createList(presentNegotiationHeaders(req))}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  // Test and analytics have the actual header values, so they additionally
  // check that the `Vary` value covers a negotiated dimension.
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      negotiatedCacheableResponse,
      validateVaryValue,
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      negotiatedCacheableResponse,
      validateVaryValue,
    ),
  )
  .done();
