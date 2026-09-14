import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- comparison-function correctness in the safe direction (weak comparison is the right choice for If-None-Match's cache-validation use), not a concern-axis topic
export default httpRule(
  'rfc9110/recipient-must-use-weak-comparison-for-if-none-match',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Which comparison function the recipient applies internally to If-None-Match is not exposed on the wire; distinguishing weak from strong comparison would require the server to mint a controllable weak ETag variant, which cannot be arranged from outside.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'A recipient MUST use the weak comparison function when comparing entity tags for If-None-Match (Section 8.8.3.2), since weak entity tags can be used for cache validation even if there have been changes to the representation data.',
  )
  .summary(
    'Recipient MUST use weak comparison function for If-None-Match ETags.',
  )
  .done();
