import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-apply-request-until-entire-header-received',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'A server MUST NOT apply a request to the target resource until it receives the entire request header section, since later header field lines might include conditionals, authentication credentials, or deliberately misleading duplicate header fields that could impact request processing.',
  )
  .summary(
    'Server MUST NOT apply a request until the entire request header section is received.',
  )
  .appliesTo('server')
  .tags('fields', 'field-order', 'server')
  .done();
