import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/final-recipient-of-trace-request-should-reflect-received-message',
)
  .severity('warn')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#114',
    'Verifying that the response reflects the message as the final recipient received it needs the full originally-sent request compared field-by-field against the response body; that whole-message reflection comparison is not expressible with the available rule APIs today. The related security concern — not echoing sensitive data — is implemented separately in final-recipient-should-exclude-sensitive-request-data-from-response-to-trace.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'The final recipient of the request SHOULD reflect the message received, excluding some fields described below, back to the client as the content of a 200 (OK) response.',
  )
  .appliesTo('server')
  .done();
