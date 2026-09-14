import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-send-final-status-after-100-continue',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#111',
    'Verifying a final status ultimately follows a 100 (Continue) requires correlating the interim response with the final one on the same request; the Transaction model pairs one request with one (final) response and never represents the interim response as an observable entity.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that sends a 100 (Continue) response MUST ultimately send a final status code, once it receives and processes the request content, unless the connection is closed prematurely.',
  )
  .appliesTo('server')
  .done();
