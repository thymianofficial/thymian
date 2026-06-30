import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  or,
  requestHeader,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

const conditionalHeaders = [
  'if-match',
  'if-none-match',
  'if-modified-since',
  'if-unmodified-since',
  'if-range',
];

function hasHeader(headers: string[], name: string): boolean {
  return headers.some((header) => header.toLowerCase() === name);
}

function presentConditionalHeaders(req: CommonHttpRequest): string[] {
  return conditionalHeaders.filter((header) => hasHeader(req.headers, header));
}

export default httpRule(
  'rfc9110/server-must-ignore-conditionals-for-connect-options-trace',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server MUST ignore the conditional request header fields defined by this specification when received with a request method that does not involve the selection or modification of a selected representation, such as CONNECT, OPTIONS, or TRACE.',
  )
  .summary(
    'Server MUST ignore conditional headers for CONNECT, OPTIONS, or TRACE methods.',
  )
  .appliesTo('server', 'origin server')
  .tags('conditional-requests', 'evaluation', 'methods')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        or(method('CONNECT'), method('OPTIONS'), method('TRACE')),
        or(
          requestHeader('if-match'),
          requestHeader('if-none-match'),
          requestHeader('if-modified-since'),
          requestHeader('if-unmodified-since'),
          requestHeader('if-range'),
        ),
        // A conditional-outcome status reveals that the server evaluated the
        // precondition instead of ignoring it.
        or(statusCode(304), statusCode(412)),
      ),
      (
        req: CommonHttpRequest,
        res: CommonHttpResponse,
        location: RuleViolationLocation,
      ) => [
        {
          location,
          violation: {
            message: `A ${req.method} request carrying conditional header field(s) ${presentConditionalHeaders(
              req,
            ).join(
              ', ',
            )} received a ${res.statusCode} response. Because ${req.method} does not select or modify a representation, the server MUST ignore conditional header fields rather than evaluate them (a 304/412 indicates they were evaluated).`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
