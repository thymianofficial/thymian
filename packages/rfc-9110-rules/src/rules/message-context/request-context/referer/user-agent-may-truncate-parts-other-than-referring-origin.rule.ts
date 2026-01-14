import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc/user-agent-may-truncate-parts-other-than-referring-origin',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'The Referer header field value need not convey the full URI of the referring resource; a user agent MAY truncate parts other than the referring origin.',
  )
  .appliesTo('user-agent')
  .done();
