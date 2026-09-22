import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-must-send-port-number-for-connect-request',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#113',
    "Thymian generates requests from an OpenAPI description, which has no way to describe a CONNECT operation or authority-form request-target, so `test` cannot exercise this; the target's authority/port is not preserved as an observable field in the captured-traffic model either, so `analyze` cannot detect an elided port.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A client MUST send the port number even if the CONNECT request is based on a URI reference that contains an authority component with an elided port.',
  )
  .appliesTo('client')
  .done();
