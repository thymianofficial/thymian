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

/**
 * The conditional request header fields must be ignored for methods that do not
 * select or modify a representation (CONNECT/OPTIONS/TRACE). A server that *did*
 * evaluate them would surface a conditional-outcome status (304 Not Modified or
 * 412 Precondition Failed). The non-conformant case is detectable from header
 * NAMES + status alone, so the common projection is sufficient and the check is
 * identical across the described transaction and recorded traffic.
 */
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
  .explanation(
    'For methods like CONNECT, OPTIONS, and TRACE that neither select nor modify a representation, the server must disregard any conditional headers (If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since, If-Range) and respond as if they were absent. Since there is no representation to compare against, a precondition has nothing meaningful to test. Evaluating one anyway would produce a spurious 304 or 412, so ignoring them keeps these methods behaving predictably.',
  )
  .appliesTo('server')
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
            ).join(', ')} received a ${res.statusCode} response.`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
