import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-truncate-parts-other-than-referring-origin',
)
  .severity('hint')
  // Informational (#327): a permissive MAY (the user agent is free to truncate
  // the Referer beyond the origin). There is no non-conformant condition to
  // detect. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'The Referer header field value need not convey the full URI of the referring resource; a user agent MAY truncate parts other than the referring origin.',
  )
  .appliesTo('user-agent')
  .done();
