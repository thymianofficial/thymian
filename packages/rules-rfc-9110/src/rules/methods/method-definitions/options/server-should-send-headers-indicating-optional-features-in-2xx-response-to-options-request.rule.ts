import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  successfulStatusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

// The Allow header is the canonical, interoperable signal of the optional
// features (supported methods) applicable to the target resource. We can only
// observe header *names*, so we approximate the SHOULD by checking that a
// successful OPTIONS response advertises at least Allow.
const featureHeaders = ['allow'];

// Response-side / server-behavior rule operating on response header names only,
// so the common projection serves all three contexts: `static` over the
// described OPTIONS 2xx response, `test` over the live response, and `analyze`
// over recorded responses.
export default httpRule(
  'rfc9110/server-should-send-headers-indicating-optional-features-in-2xx-response-to-options-request',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A server generating a successful response to OPTIONS SHOULD send any header that might indicate optional features implemented by the server and applicable to the target resource (e.g., Allow), including potential extensions not defined by this specification.',
  )
  // 'origin server' is included so the rule fires on HAR responses.
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), successfulStatusCode()),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        const present = featureHeaders.some((name) =>
          res.headers.some((header) => header.toLowerCase() === name),
        );

        if (present) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A successful response to OPTIONS SHOULD advertise the optional features applicable to the target resource (e.g., via an Allow header), but this response includes no such header.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
