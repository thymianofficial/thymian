import { httpRule } from '@thymian/core';

/**
 * The MUST NOT is conditional: a client may generate an If-Range HTTP-date *when
 * it has no entity tag for the representation and the date is a strong
 * validator*. Whether the client holds an entity tag is private client state,
 * and "the date is a strong validator" depends on the origin server's
 * Date/Last-Modified relationship at the time the validator was obtained —
 * neither is recoverable from the request on the wire. The conformant and
 * non-conformant cases are therefore indistinguishable from observable data.
 * (The unconditionally-forbidden sub-case — a *weak* entity tag in If-Range — is
 * detected by `client-must-not-generate-if-range-with-weak-etag`.)
 */
export default httpRule(
  'rfc9110/client-must-not-generate-if-range-header-containing-http-date',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A client MUST NOT generate an If-Range header field containing an HTTP-date unless the client has no entity tag for the corresponding representation and the date is a strong validator in the sense defined by Section 8.8.2.2.',
  )
  .summary(
    'A client MUST NOT generate an If-Range header field containing an HTTP-date.',
  )
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
