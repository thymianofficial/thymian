import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- precondition evaluation ordering, not a concern-axis topic
export default httpRule('rfc9110/server-must-evaluate-if-range')
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'Internal evaluation timing is not observable on the wire.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A server that receives an If-Range header field on a Range request MUST evaluate the condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Server MUST evaluate If-Range condition before performing the method.',
  )
  .explanation(
    'The externally checkable consequences are split across recipient-must-ignore-range-when-if-range-false (condition false) and recipient-should-process-range-header-if-if-range-matches (condition true).',
  )
  .appliesTo('server')
  .done();
