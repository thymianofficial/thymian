import { httpRule } from '@thymian/core';

/**
 * This MUST is about internal evaluation timing (evaluate If-Range before
 * performing the method), which is not observable on the wire. The externally
 * checkable consequences are split across
 * `recipient-must-ignore-range-when-if-range-false` (the condition-false case)
 * and `recipient-should-process-range-header-if-if-range-matches` (the
 * condition-true case).
 */
export default httpRule('rfc9110/server-must-evaluate-if-range')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A server that receives an If-Range header field on a Range request MUST evaluate the condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Server MUST evaluate If-Range condition before performing the method.',
  )
  .appliesTo('server')
  .done();
