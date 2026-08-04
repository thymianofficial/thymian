import {
  and,
  getHeader,
  hasResponseBody,
  httpRule,
  method,
  type RuleViolationLocation,
} from '@thymian/core';

import { createList } from '../../../../utils.js';
import { sensitiveHeaders } from './trace-sensitive-headers.js';

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(', ') : value;
}

// This SHOULD check needs a REAL sensitive request header VALUE echoed into the
// TRACE response body. In a generated test the request is Thymian-generated and
// carries no genuine secret, so the value-echo check is inert there; recorded
// TRACE responses contain real client header values reflected back in the
// response content.
export default httpRule(
  'rfc9110/final-recipient-should-exclude-sensitive-request-data-from-response-to-trace',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'The final recipient of the request SHOULD exclude any request fields that are likely to contain sensitive data when that recipient generates the response content.',
  )
  .explanation(
    'When your server is the final recipient of a TRACE and builds the reflected response body, it should strip out request fields likely to hold sensitive data rather than echoing them back verbatim. This matters because TRACE mirrors the request into the response, so faithfully reflecting fields like credentials or cookies would expose them; filtering them out protects secrets even when a client mistakenly included them, acting as a safety net on the receiving end.',
  )
  .appliesTo('server')
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
              )}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
