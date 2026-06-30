import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-bws')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'The BWS rule is used where the grammar allows optional whitespace only for historical reasons. A sender MUST NOT generate BWS in messages.',
  )
  .summary('Sender MUST NOT generate bad whitespace (BWS) in messages.')
  .done();
