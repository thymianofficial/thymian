import {
  and,
  hasRequestBody,
  httpRule,
  method,
  not,
  requestHeader,
} from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-send-content-type-header-for-content-in-options-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client that generates an OPTIONS request containing content MUST send a valid Content-Type header field describing the representation media type.',
  )
  .explanation(
    "If your client attaches a body to an OPTIONS request, it must also include a Content-Type header that correctly describes that body's media type. This matters because a body with no declared type leaves the server guessing how to parse it; declaring the type keeps the message unambiguous and lets any recipient in the chain handle the content correctly, even though HTTP defines no standard use for content in an OPTIONS request.",
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), hasRequestBody()),
      not(requestHeader('content-type')),
    ),
  )
  .done();
