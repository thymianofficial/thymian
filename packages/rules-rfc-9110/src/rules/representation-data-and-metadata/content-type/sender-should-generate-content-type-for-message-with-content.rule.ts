import { and, hasResponseBody, not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-generate-content-type-for-message-with-content',
)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `A sender that generates a message containing content SHOULD generate a Content-Type header field
    in that message unless the intended media type of the enclosed representation is unknown to the sender.`,
  )
  .summary(
    'Servers SHOULD send Content-Type header in responses containing content.',
  )
  .explanation(
    "Whenever a sender produces a message with a body, it should include a Content-Type header naming the body's media type -- the only excuse to omit it is genuinely not knowing what the type is. It matters because Content-Type tells the recipient both the data format and how to process it; leaving it out forces the recipient to assume octet-stream or sniff the bytes, which can guess wrong and introduce interoperability and security problems.",
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(hasResponseBody(), not(responseHeader('content-type'))),
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'The response contains content but no Content-Type header field.',
          },
          findings: [],
        },
      ],
    ),
  )
  .overrideStaticRule((ctx) =>
    ctx.validateHttpTransactions((req, res) => !!res.schema && !res.mediaType),
  )
  .done();
