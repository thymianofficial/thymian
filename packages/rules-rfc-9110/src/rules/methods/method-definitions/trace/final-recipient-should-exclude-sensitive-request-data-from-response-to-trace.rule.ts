import {
  and,
  getHeader,
  hasResponseBody,
  httpRule,
  method,
  type RuleViolationLocation,
} from '@thymian/core';

import { createList } from '../../../../utils.js';

// Header fields that are likely to carry sensitive data and therefore SHOULD
// NOT be echoed back in the reflected message of a TRACE response.
const sensitiveHeaders = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
];

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(', ') : value;
}

// Response-side / server-behavior rule (security-relevant). The final
// recipient of a TRACE echoes the received message back as the 200 response
// content; this rule checks that it stripped sensitive request fields rather
// than reflecting their values. It must read header VALUES and the response
// body, which are only available on the live `LiveApiContext`, so it uses
// `validateHttpTransactions`. It runs in `test` (Thymian can send a TRACE
// carrying a sensitive header and inspect the echoed body) and `analyze`
// (recorded TRACE responses). It is genuinely a response-side check — what the
// server chose to include in its generated content — so `test` is appropriate.
export default httpRule(
  'rfc9110/final-recipient-should-exclude-sensitive-request-data-from-response-to-trace',
)
  .severity('warn')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'The final recipient of the request SHOULD exclude any request fields that are likely to contain sensitive data when that recipient generates the response content.',
  )
  // 'origin server' is included so the rule fires on HAR responses.
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(method('TRACE'), hasResponseBody()),
      (req, res, location: RuleViolationLocation) => {
        const body = res.body;

        if (!body) {
          return [];
        }

        // Sensitive request header values whose verbatim text was echoed back
        // into the reflected response content.
        const leaked = sensitiveHeaders.filter((name) => {
          const value = headerToString(getHeader(req.headers ?? {}, name));

          if (!value || value.trim().length === 0) {
            return false;
          }

          return body.includes(value);
        });

        if (leaked.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The reflected TRACE response content echoes the value of sensitive request header field(s) ${createList(
                leaked,
              )}. The final recipient SHOULD exclude request fields likely to contain sensitive data when generating the response content.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
