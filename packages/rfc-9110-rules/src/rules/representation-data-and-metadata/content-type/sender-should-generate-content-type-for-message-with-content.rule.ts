import { and, hasResponseBody, not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-generate-content-type-for-message-with-content',
)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `A sender that generates a message containing content SHOULD generate a Content-Type header field
    in that message unless the intended media type of the enclosed representation is unknown to the sender.`,
  )
  .summary(
    'Servers SHOULD send Content-Type header in responses containing content.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(hasResponseBody(), not(responseHeader('content-type'))),
    ),
  )
  .overrideStaticRule((ctx) =>
    ctx.validateHttpTransactions((req, res) => !!res.schema && !res.mediaType),
  )
  .done();
