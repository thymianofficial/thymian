import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-omit-header-fields-for-head-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up returns a HEAD response with fewer header fields than the GET for the same target — Section 9.3.2 names Content-Length and Vary — and server-should-send-same-header-fields-in-response-to-head already compares those two field sets across transactions. The hint naming the fields the server omitted is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'A server MAY omit header fields for which a value is determined only while generating the content.',
  )
  .appliesTo('server')
  .done();
