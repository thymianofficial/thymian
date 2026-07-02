import { httpRule } from '@thymian/core';

/**
 * This MUST constrains *which comparison function* the origin server applies
 * internally to If-Match entity tags (strong vs. weak). The choice of
 * comparison function is not exposed in any single response; distinguishing it
 * would require crafting weak/strong ETag pairs that differ only in weakness and
 * observing divergent precondition outcomes, which depends on the server minting
 * a controllable weak ETag for the same representation — not something the
 * framework can arrange generically. The security-relevant intent (preventing
 * lost updates) is realized by the must-not-perform-method rule.
 */
export default httpRule(
  'rfc9110/origin-server-must-use-strong-comparison-for-if-match',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server MUST use the strong comparison function when comparing entity tags for If-Match (Section 8.8.3.2), since the client intends this precondition to prevent the method from being applied if there have been any changes to the representation data.',
  )
  .summary(
    'Origin server MUST use strong comparison function for If-Match ETags.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-match', 'etag')
  .done();
