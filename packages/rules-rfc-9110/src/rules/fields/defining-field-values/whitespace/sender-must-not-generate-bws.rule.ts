import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-bws')
  .severity('error')
  // Informational: BWS is raw whitespace at specific grammar positions on the
  // wire. By the time Thymian observes a message the HTTP layer has parsed and
  // normalized field values, so the original octet-level BWS the sender did or
  // did not generate is no longer present to inspect; nor does it survive into
  // a HAR's parsed headers. With no preserved on-the-wire representation there
  // is nothing observable to flag. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'The BWS rule is used where the grammar allows optional whitespace only for historical reasons. A sender MUST NOT generate BWS in messages.',
  )
  .summary('Sender MUST NOT generate bad whitespace (BWS) in messages.')
  .done();
