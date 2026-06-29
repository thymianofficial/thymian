import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-associate-quality-value-with-charset',
)
  .severity('hint')
  // Informational: this is a permissive "MAY" granting the user agent the
  // option to attach a quality value to an Accept-Charset charset. There is no
  // condition under which a transaction is non-conformant — associating (or
  // not associating) a weight is always allowed — so no execution context can
  // produce a meaningful pass/fail. The previous `static`/`analytics`
  // classification merely flagged the presence of the request header, which is
  // noise rather than a conformance check. (Accept-Charset is also deprecated
  // by RFC 9110 Section 12.5.2.)
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-charset')
  .description(
    "A user agent MAY associate a quality value with each charset to indicate the user's relative preference for that charset, as defined in Section 12.4.2.",
  )
  .appliesTo('user-agent')
  .done();
