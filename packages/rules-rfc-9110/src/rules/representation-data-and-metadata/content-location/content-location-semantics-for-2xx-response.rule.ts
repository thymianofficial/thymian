import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- recipient-side interpretive semantics, not a concern this vocabulary covers
export default httpRule('rfc9110/content-location-semantics-for-2xx-response')
  .severity('off')
  .type(
    'informational',
    'nothing-to-check',
    'No HTTP message can conform to this or violate it: the first half defines what a Content-Location value identifies, and the second grants the recipient an inference — treating the content as a current representation of the target URI — that it draws for itself. Neither half places a condition on any message a sender emits.',
  )
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.7')
  .description(
    `The "Content-Location" header field references a URI that can be used as an identifier for a specific resource
    corresponding to the representation in this message's content. If Content-Location is included in a 2xx response
    and its value refers to the same URI as the target URI, then the recipient MAY consider the content to be a current
    representation of that resource at the time indicated by the message origination date.`,
  )
  .summary(
    'Content-Location provides a URI identifier for the representation in the message content.',
  )
  .done();
