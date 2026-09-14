import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-reject-connect-request-with-empty-or-invalid-port-number',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#113',
    'Thymian generates requests from an OpenAPI description, which has no way to describe CONNECT or authority-form targets, so it cannot synthesize the malformed request `test` would need; a HAR does not preserve the CONNECT authority-form target either, so `analyze` cannot identify the invalid-port condition.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A server MUST reject a CONNECT request that targets an empty or invalid port number, typically by responding with a 400 (Bad Request) status code.',
  )
  .appliesTo('server')
  .done();
