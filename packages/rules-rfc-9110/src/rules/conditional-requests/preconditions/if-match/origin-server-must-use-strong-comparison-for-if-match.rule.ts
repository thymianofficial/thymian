import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- lost-update hazard -- If-Match's whole purpose is preventing a lost update, but 'lost update' is a reliability concern the vocabulary deliberately does not yet carry (#90's recorded reliability expansion path), not security or privacy
export default httpRule(
  'rfc9110/origin-server-must-use-strong-comparison-for-if-match',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Which comparison function (strong vs weak) the origin applies internally to If-Match ETags is not exposed in any single response; distinguishing them would require the origin to mint a controllable weak ETag variant of the same representation, which cannot be arranged from outside.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server MUST use the strong comparison function when comparing entity tags for If-Match (Section 8.8.3.2), since the client intends this precondition to prevent the method from being applied if there have been any changes to the representation data.',
  )
  .summary(
    'Origin server MUST use strong comparison function for If-Match ETags.',
  )
  .explanation(
    'The security-relevant intent — preventing a lost update — is realized by the must-not-perform-method rule.',
  )
  .appliesTo('origin server')
  .done();
