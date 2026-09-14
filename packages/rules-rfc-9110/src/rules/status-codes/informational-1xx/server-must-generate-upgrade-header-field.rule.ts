import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-must-generate-upgrade-header-field')
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#111',
    'Concerns the interim 101 response. 1xx interim responses are not captured as discrete transactions (only the final response is recorded), so the Upgrade header on a 101 cannot be observed.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-101-switching-protocols',
  )
  .description(
    "The 101 (Switching Protocols) status code indicates that the server understands and is willing to comply with the client's request, via the Upgrade header field (Section 7.8), for a change in the application protocol being used on this connection. The server MUST generate an Upgrade header field in the response that indicates which protocol(s) will be in effect after this response.",
  )
  .summary(
    'The server MUST generate an Upgrade header field in the response that indicates which protocol(s) will be in effect after this response.',
  )
  .appliesTo('server')
  .done();
