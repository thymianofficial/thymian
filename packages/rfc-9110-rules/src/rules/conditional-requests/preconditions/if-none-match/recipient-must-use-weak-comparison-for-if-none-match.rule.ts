import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-must-use-weak-comparison-for-if-none-match',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'A recipient MUST use the weak comparison function when comparing entity tags for If-None-Match (Section 8.8.3.2), since weak entity tags can be used for cache validation even if there have been changes to the representation data.',
  )
  .summary(
    'Recipient MUST use weak comparison function for If-None-Match ETags.',
  )
  .appliesTo('server', 'cache')
  .tags('conditional-requests', 'if-none-match', 'etag')
  .done();
