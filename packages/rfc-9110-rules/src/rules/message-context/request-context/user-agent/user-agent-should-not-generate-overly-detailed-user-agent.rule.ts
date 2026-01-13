import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD NOT generate a User-Agent header field containing needlessly fine-grained detail.',
  )
  .appliesTo('user-agent')
  .done();
