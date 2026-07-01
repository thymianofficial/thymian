import { httpRule } from '@thymian/core';

// Informational (reclassified from static/analytics): this is a purely
// permissive MAY — a client is allowed, but never required, to send a
// Max-Forwards header on an OPTIONS request. The previous implementation
// flagged the *absence* of Max-Forwards on every OPTIONS request as a
// violation, which inverts the spec (it would mark conformant requests as
// faulty). There is no non-conformant condition to detect, so the rule ships
// no function.
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
