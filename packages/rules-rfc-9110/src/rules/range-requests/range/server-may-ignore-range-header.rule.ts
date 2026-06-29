import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-may-ignore-range-header')
  .severity('hint')
  // Informational (outcome 2): a baseline "MAY" permission — a server is always
  // free to ignore the Range header (answering with a full 200), so there is no
  // non-conformant condition. The accompanying "ought to support byte ranges"
  // is non-normative advice, not a testable requirement.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A server MAY ignore the Range header field. However, origin servers and intermediate caches ought to support byte ranges when possible, since they support efficient recovery from partially failed transfers and partial retrieval of large representations.',
  )
  .summary('A server may ignore the Range header field.')
  .appliesTo('server')
  .done();
