import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-forward-incorrect-content-length',
)
  .severity('error')
  .type('informational')
  .appliesTo('server', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A sender MUST NOT forward a message with a Content-Length header field value that is known to be incorrect.`,
  )
  .summary(
    'Servers and intermediaries MUST NOT forward messages with known incorrect Content-Length.',
  )
  .done();
