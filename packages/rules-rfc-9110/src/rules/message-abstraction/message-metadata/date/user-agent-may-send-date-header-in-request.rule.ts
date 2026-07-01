import { httpRule } from '@thymian/core';

// Informational (outcome 2): this is a request-side permissive "MAY". A user
// agent MAY send a Date header field in a request, and generally will not. Both
// sending and omitting Date are conformant, so there is no non-conformant
// condition to detect. The previous `analytics` implementation reported every
// request that lacked a Date header, which is the normal, conformant case and
// not a violation. It has therefore been reclassified to informational.
export default httpRule('rfc9110/user-agent-may-send-date-header-in-request')
  .severity('hint')
  .type('informational')
  .appliesTo('user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'A user agent MAY send a Date header field in a request, though generally will not do so unless it is believed to convey useful information to the server.',
  )
  .summary('A user agent MAY send a Date header field in a request.')
  .done();
