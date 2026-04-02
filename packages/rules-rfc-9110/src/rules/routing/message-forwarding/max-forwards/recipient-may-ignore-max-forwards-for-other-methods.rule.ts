import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-ignore-max-forwards-for-other-methods',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'A recipient MAY ignore a Max-Forwards header field received with any other request methods. The Max-Forwards mechanism is specifically designed for TRACE and OPTIONS methods to limit forwarding.',
  )
  .summary(
    'Recipient MAY ignore Max-Forwards for methods other than TRACE/OPTIONS.',
  )
  .done();
