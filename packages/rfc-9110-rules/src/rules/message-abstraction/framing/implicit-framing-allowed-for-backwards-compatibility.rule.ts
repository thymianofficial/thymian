import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/implicit-framing-allowed-for-backwards-compatibility',
)
  .severity('hint')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.1')
  .description(
    'HTTP/0.9 and early deployments of HTTP/1.0 used closure of the underlying connection to end a response. For backwards compatibility, this implicit framing is also allowed in HTTP/1.1. However, implicit framing can fail to distinguish an incomplete response if the connection closes early. For that reason, almost all modern implementations use explicit framing in the form of length-delimited sequences of message data.',
  )
  .summary(
    'Implicit framing (connection closure) is allowed for backwards compatibility but discouraged.',
  )
  .done();
