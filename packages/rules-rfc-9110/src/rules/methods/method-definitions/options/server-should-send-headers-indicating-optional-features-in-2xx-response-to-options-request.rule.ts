import {
  and,
  method,
  not,
  or,
  responseHeader,
  successfulStatusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), successfulStatusCode()),
      not(or(...headerNames.map((name) => responseHeader(name)))),
    ),
  )
  .done();
