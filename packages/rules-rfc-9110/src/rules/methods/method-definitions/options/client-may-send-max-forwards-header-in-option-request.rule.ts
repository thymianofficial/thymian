import { httpRule } from '@thymian/core';

// This is a purely permissive MAY — a client is allowed, but never required, to
// send a Max-Forwards header on an OPTIONS request. There is no non-conformant
// condition to detect.
export default httpRule(
  'rfc9110/client-may-send-max-forwards-header-in-option-request',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client MAY send a Max-Forwards header field in an OPTIONS request to target a specific recipient in the request chain.',
  )
  .appliesTo('client')
  .done();
