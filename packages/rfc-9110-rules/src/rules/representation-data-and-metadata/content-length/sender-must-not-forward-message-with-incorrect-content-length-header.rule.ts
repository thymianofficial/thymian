import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-not-forward-message-with-incorrect-content-length-header',
)
  .severity('error')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `Because Content-Length is used for message delimitation in HTTP/1.1, its field value can impact how the message is parsed by downstream recipients even when the immediate connection is not using HTTP/1.1. If the message is forwarded by a downstream intermediary, a Content-Length field value that is inconsistent with the received message framing might cause a security failure due to request smuggling or response splitting. As a result, a sender MUST NOT forward a message with a Content-Length header field value that is known to be incorrect.`,
  )
  .summary(
    'A sender MUST NOT forward a message with a Content-Length header field value that is known to be incorrect.',
  )
  .done();
