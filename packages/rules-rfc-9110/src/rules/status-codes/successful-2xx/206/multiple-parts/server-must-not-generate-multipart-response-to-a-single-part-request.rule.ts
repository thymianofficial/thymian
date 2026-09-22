import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-not-generate-multipart-response-to-a-single-part-request',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#112',
    'Requires determining that the request asked for exactly one range; counting ranges from the Range header reliably across its permitted syntaxes is not implemented, so the single-part precondition cannot be established.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-multiple-parts')
  .description(
    'A server MUST NOT generate a multipart response to a request for a single range, since a client that does not request multiple parts might not support multipart responses.',
  )
  .appliesTo('server')
  .done();
