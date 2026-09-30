import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc-6797/hsts-host-must-not-treat-empty-path-as-slash-when-comparing-effective-request-uris',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'The comparison happens inside whichever party compares two effective request URIs; neither URI, nor the outcome of comparing them, appears in any message. A redirect Location built from the effective request URI (§7.2) is checked by hsts-host-should-redirect-insecure-requests-to-https.',
  )
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-9.2')
  .description(
    'Effective request URIs are compared using the rules described in [RFC2616] Section 3.2.3, except that empty path components MUST NOT be treated as equivalent to an absolute path of "/".',
  )
  .summary(
    'HSTS Host must not treat an empty path as "/" when comparing effective request URIs.',
  )
  .explanation(
    'Under RFC 2616\'s comparison rules an empty path and "/" name the same resource; RFC 6797 keeps them apart when effective request URIs are compared. The distinction lives inside the party that does the comparing and never shows on the wire, so this rule documents the requirement rather than checking it.',
  )
  .appliesTo('server')
  .done();
