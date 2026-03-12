import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/intermediary-must-generate-updated-max-forwards-when-forwarding',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    "If the received Max-Forwards value is greater than zero, the intermediary MUST generate an updated Max-Forwards field in the forwarded message with a field value that is the lesser of a) the received value decremented by one (1) or b) the recipient's maximum supported value for Max-Forwards.",
  )
  .summary('Intermediary MUST generate updated Max-Forwards when forwarding.')
  .appliesTo('intermediary')
  .done();
