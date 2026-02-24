import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/head-204-304-response-has-no-content')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the request method is HEAD or the response status code is 204 (No Content) or 304 (Not Modified), there is no content in the response.',
  )
  .summary(
    'HEAD, 204, and 304 responses have no content for identification purposes.',
  )
  .done();
