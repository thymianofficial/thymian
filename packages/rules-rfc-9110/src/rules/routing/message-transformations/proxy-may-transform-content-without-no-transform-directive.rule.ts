import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-may-transform-content-without-no-transform-directive',
)
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MAY transform the content of a message that does not contain a no-transform cache directive. A proxy that transforms the content of a 200 (OK) response can inform downstream recipients that a transformation has been applied by changing the response status code to 203 (Non-Authoritative Information).',
  )
  .summary('Proxy MAY transform content without no-transform directive.')
  .appliesTo('proxy')
  .done();
