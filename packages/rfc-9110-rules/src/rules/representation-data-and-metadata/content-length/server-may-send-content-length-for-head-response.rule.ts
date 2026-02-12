import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-may-send-content-length-for-head-response',
)
  .severity('off')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MAY send a Content-Length header field in a response to a HEAD request;
    a server MUST NOT send Content-Length in such a response unless its field value equals
    the decimal number of octets that would have been sent in the content of a response if
    the same request had used the GET method.`,
  )
  .summary(
    'Servers MAY send Content-Length in HEAD responses (must match what GET would return).',
  )
  .done();
