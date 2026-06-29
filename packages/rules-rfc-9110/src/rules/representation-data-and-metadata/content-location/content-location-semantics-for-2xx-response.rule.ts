import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/content-location-semantics-for-2xx-response')
  .severity('off')
  // Informational (outcome 2): this describes what Content-Location MEANS in a
  // 2xx response and grants the recipient a permission ("MAY consider the
  // content to be a current representation ...") when its value matches the
  // target URI. It states no obligation on the sender and no non-conformant
  // condition to detect — sending, or not sending, Content-Location is both
  // legal. Pure interpretive guidance, so it stays informational with no rule
  // function.
  .type('informational')
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
