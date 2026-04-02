import { httpRule } from '@thymian/core';

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
