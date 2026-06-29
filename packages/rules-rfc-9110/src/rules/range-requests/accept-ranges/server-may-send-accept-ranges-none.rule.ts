import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-may-send-accept-ranges-none')
  .severity('hint')
  // Informational (outcome 2): a pure "MAY" permission. A server is free to send
  // "Accept-Ranges: none" or to omit it; both are conformant, so there is no
  // non-conformant condition. The previous rule flagged every response that did
  // NOT carry "Accept-Ranges: none" as a violation, which is backwards — it
  // turns an optional advisory into a mandatory header and would fire on
  // essentially all normal traffic. Whether a server "does not support any kind
  // of range request" (the precondition for the advice) is also not observable.
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
