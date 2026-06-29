import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  hasRequestBody,
  httpRule,
  method,
} from '@thymian/core';

// Request-side rule: it constrains what the *client* sends (an OPTIONS request
// carrying content must declare a Content-Type). It is therefore `analyze`
// only — in `test` Thymian is the sender, so request content is not under user
// control. `static` (lint) is intentionally NOT used: this check looks for a
// `content-type` entry in the request's header NAMES, but in the spec
// projection `CommonHttpRequest.headers = Object.keys(node.headers)` exposes
// only explicitly-declared header PARAMETERS. An OpenAPI request media type is
// declared via the requestBody content map (projected to `req.mediaType` /
// `req.body`), essentially never as a `Content-Type` header parameter, so a
// lint slot would flag almost every OPTIONS operation with a requestBody — a
// systematic false positive. The header-name check is meaningful only against
// real recorded requests (`analyze`).
//
// Only header-name *presence* is checkable from the common projection (header
// VALUES are not exposed there), so this rule flags a missing Content-Type
// header; it does not assess whether the value is a "valid" media type.
export default httpRule(
  'rfc9110/client-must-send-content-type-header-for-content-in-options-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client that generates an OPTIONS request containing content MUST send a valid Content-Type header field describing the representation media type.',
  )
  // Request-side roles so the rule matches HAR requests (default 'user-agent').
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), hasRequestBody()),
      (req: CommonHttpRequest, _res: CommonHttpResponse, location) => {
        const hasContentType = req.headers.some(
          (header) => header.toLowerCase() === 'content-type',
        );

        if (hasContentType) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'An OPTIONS request that carries content MUST include a Content-Type header field describing the representation media type, but none is present.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
