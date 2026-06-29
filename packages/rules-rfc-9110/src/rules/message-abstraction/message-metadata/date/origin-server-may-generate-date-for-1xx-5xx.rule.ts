import { httpRule } from '@thymian/core';

// Informational (outcome 2): this is a pure permissive "MAY". An origin server
// MAY generate a Date header field in 1xx and 5xx responses, but it is equally
// conformant to omit it. There is therefore no non-conformant condition to
// detect — neither presence nor absence of Date on a 1xx/5xx response is a
// violation. The previous `analytics` implementation flagged every 1xx/5xx
// response that lacked a Date header, which is exactly the conformant case and
// not a violation at all, so it has been reclassified to informational.
export default httpRule('rfc9110/origin-server-may-generate-date-for-1xx-5xx')
  .severity('hint')
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'An origin server with a clock (as defined in Section 5.6.7) MAY generate a Date header field in 1xx (Informational) and 5xx (Server Error) responses.',
  )
  .summary('Origin servers MAY generate Date header in 1xx and 5xx responses.')
  .done();
