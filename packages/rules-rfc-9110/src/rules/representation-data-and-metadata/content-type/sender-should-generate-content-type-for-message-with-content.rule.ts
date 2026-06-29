import { and, hasResponseBody, not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-generate-content-type-for-message-with-content',
)
  .severity('warn')
  // Implementable now (outcome 1): a response-side presence check that only
  // needs the Content-Type header NAME and body presence, so the common
  // projection is sufficient and the same shared `.rule()` runs in static,
  // test, and analyze. Lint uses an `overrideStaticRule` because the spec-node
  // projection exposes the declared schema/media type directly. `appliesTo`
  // uses 'origin server' (not bare 'server') so the analyze rule fires on HAR
  // responses (default response role = 'origin server').
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
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
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'The response contains content but no Content-Type header field. A sender SHOULD generate Content-Type unless the media type of the enclosed representation is unknown.',
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
