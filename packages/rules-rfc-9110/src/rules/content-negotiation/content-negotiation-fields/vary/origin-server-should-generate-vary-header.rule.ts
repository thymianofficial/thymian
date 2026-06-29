import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  or,
  requestHeader,
  statusCodeRange,
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

function hasHeader(headers: string[], name: string): boolean {
  return headers.some((header) => header.toLowerCase() === name);
}

function presentNegotiationHeaders(req: CommonHttpRequest): string[] {
  return negotiationRequestHeaders.filter((header) =>
    hasHeader(req.headers, header),
  );
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
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        // Only safe, cacheable methods can yield a stored, reusable response.
        or(method('GET'), method('HEAD')),
        // A 2xx response is the cacheable, negotiable case this rule targets.
        statusCodeRange(200, 299),
        // The request expressed proactive-negotiation preferences, so the
        // response was likely tailored to them.
        or(...negotiationRequestHeaders.map((header) => requestHeader(header))),
      ),
      (req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        if (hasHeader(res.headers, 'vary')) {
          return [];
        }

        const negotiationHeaders = presentNegotiationHeaders(req);

        return [
          {
            location,
            violation: {
              message: `A cacheable ${req.method} response was returned for a request carrying proactive-negotiation header field(s) ${createList(
                negotiationHeaders,
              )} but does not include a Vary header field. The origin server SHOULD generate a Vary header so shared caches do not reuse this representation for requests expressing different preferences (a cache-poisoning hazard).`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
