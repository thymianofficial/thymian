import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-ignore-if-range-without-range')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A server MUST ignore an If-Range header field received in a request that does not contain a Range header field. An origin server MUST ignore an If-Range header field received in a request for a target resource that does not support Range requests.',
  )
  .summary('Server MUST ignore If-Range without Range header field.')
  .appliesTo('server', 'origin server')
  .tags('conditional-requests', 'if-range', 'range')
  .done();
