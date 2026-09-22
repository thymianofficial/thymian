import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-truncate-parts-other-than-referring-origin',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends a Referer carrying the referring origin alone, where one that declines sends the full path and query; the recorded request carries the value either way. The hint — the Referer discloses more of the referring URI than the origin the server needs — is not written yet.',
  )
  .tags('privacy:referrer')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'The Referer header field value need not convey the full URI of the referring resource; a user agent MAY truncate parts other than the referring origin.',
  )
  .appliesTo('user-agent')
  .done();
