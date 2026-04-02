import { httpRule } from '@thymian/core';

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
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
