import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-not-send-non-conformant-version')
  .severity('error')
  .type('informational')
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A client MUST NOT send a version to which it is not conformant. A client SHOULD send a request version equal to the highest version to which the client is conformant and whose major version is no higher than the highest version supported by the server, if this is known.',
  )
  .summary('Clients MUST NOT send HTTP version they are not conformant to.')
  .done();
