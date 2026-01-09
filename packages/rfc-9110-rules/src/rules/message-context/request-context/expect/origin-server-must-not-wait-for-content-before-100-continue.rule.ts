import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-not-wait-for-content-before-100-continue',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'The origin server MUST NOT wait for the content before sending the 100 (Continue) response.',
  )
  .appliesTo('origin server')
  .done();
