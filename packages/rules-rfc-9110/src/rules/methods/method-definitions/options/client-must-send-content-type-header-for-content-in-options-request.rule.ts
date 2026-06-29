import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  hasRequestBody,
  httpRule,
  method,
} from '@thymian/core';

// Request-side rule: it constrains what the *client* sends (an OPTIONS request
// carrying content must declare a Content-Type). `analyze` validates real
// client requests; `static` validates whether the OpenAPI description that
// declares an OPTIONS request body also declares the media type. `test` is
// intentionally absent because Thymian is the sender there.
//
// Only header-name *presence* is checkable from the common projection (header
// VALUES are not exposed there), so this rule flags a missing Content-Type
// header; it does not assess whether the value is a "valid" media type.
export default httpRule(
  'rfc9110/client-must-send-content-type-header-for-content-in-options-request',
)
  .severity('error')
  .type('static', 'analytics')
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
