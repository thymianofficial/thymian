import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-should-send-405-response-for-unallowed-method',
)
  .severity('warn')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#110',
    'Provoking this needs a request using a method the API description does not declare for the target resource; Thymian generates requests from the spec, so it never naturally produces a "recognized but disallowed" request to check the 405 response for.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'An origin server that receives a request method that is recognized and implemented, but not allowed for the target resource, SHOULD respond with the 405 (Method Not Allowed) status code.',
  )
  .appliesTo('origin server')
  .done();
