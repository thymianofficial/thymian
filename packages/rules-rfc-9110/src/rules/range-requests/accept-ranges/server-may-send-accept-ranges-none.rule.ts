import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-may-send-accept-ranges-none')
  .severity('hint')
  // Informational (outcome 2): a pure "MAY" permission. A server may send
  // "Accept-Ranges: none" or omit it; both are conformant, so there is no
  // non-conformant condition. Whether the server supports no range requests at
  // all (the precondition for the advice) is also not observable.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'A server that does not support any kind of range request for the target resource MAY send "Accept-Ranges: none" to advise the client not to attempt a range request on the same request path. The range unit "none" is reserved for this purpose.',
  )
  .summary(
    'Server may send "Accept-Ranges: none" to advise against range requests.',
  )
  .appliesTo('origin server')
  .done();
