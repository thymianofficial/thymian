import {
  and,
  method,
  not,
  or,
  responseHeader,
  successfulStatusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

// The Allow header is the canonical, interoperable signal of the optional
// features (supported methods) applicable to the target resource. We can only
// observe header *names*, so we approximate the SHOULD by checking that a
// successful OPTIONS response advertises at least Allow.
const headerNames = ['allow'];

export default httpRule(
  'rfc9110/server-should-send-headers-indicating-optional-features-in-2xx-response-to-options-request',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A server generating a successful response to OPTIONS SHOULD send any header that might indicate optional features implemented by the server and applicable to the target resource (e.g., Allow), including potential extensions not defined by this specification.',
  )
  .explanation(
    "When your server answers an OPTIONS request successfully, it should advertise what the target resource supports by sending headers such as Allow that name the applicable optional features. This matters because the whole point of OPTIONS is to let a client discover a resource's capabilities without acting on it; a bare 2xx response with no such headers tells the client nothing, defeating that purpose and forcing it to guess which methods and features are available.",
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), successfulStatusCode()),
      not(or(...headerNames.map((name) => responseHeader(name)))),
    ),
  )
  .done();
