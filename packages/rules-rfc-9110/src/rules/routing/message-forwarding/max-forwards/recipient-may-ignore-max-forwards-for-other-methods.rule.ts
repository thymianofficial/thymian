import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY; Max-Forwards only mitigates loops for TRACE/OPTIONS, so ignoring it elsewhere is not the hazard
export default httpRule(
  'rfc9110/recipient-may-ignore-max-forwards-for-other-methods',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A recipient that honours Max-Forwards on a method other than TRACE or OPTIONS forwards the field decremented, or answers as the final recipient; one that takes this permission up forwards it untouched. A multi-hop trace carries both the inbound and the outbound message with a role each, and that comparison is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'A recipient MAY ignore a Max-Forwards header field received with any other request methods. The Max-Forwards mechanism is specifically designed for TRACE and OPTIONS methods to limit forwarding.',
  )
  .summary(
    'Recipient MAY ignore Max-Forwards for methods other than TRACE/OPTIONS.',
  )
  .done();
