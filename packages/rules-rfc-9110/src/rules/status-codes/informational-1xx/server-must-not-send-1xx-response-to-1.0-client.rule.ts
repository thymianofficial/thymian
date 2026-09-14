import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-not-send-1xx-response-to-1.0-client',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#111',
    "Correlating the client's HTTP protocol version with an interim 1xx response requires observing that response, and 1xx responses are not represented as discrete transactions in captured traffic.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-informational-1xx')
  .description(
    'The 1xx (Informational) class of status code indicates an interim response for communicating connection status or request progress prior to completing the requested action and sending a final response. Since HTTP/1.0 did not define any 1xx status codes, a server MUST NOT send a 1xx response to an HTTP/1.0 client.',
  )
  .summary(
    'Since HTTP/1.0 did not define any 1xx status codes, a server MUST NOT send a 1xx response to an HTTP/1.0 client.',
  )
  .appliesTo('server')
  .done();
