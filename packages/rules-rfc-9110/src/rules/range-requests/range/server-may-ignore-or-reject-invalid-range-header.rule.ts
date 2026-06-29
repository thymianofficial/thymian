import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-ignore-or-reject-invalid-range-header',
)
  .severity('hint')
  // Informational (outcome 2): a "MAY" permission (with a security rationale —
  // invalid/overlapping/unordered ranges can signal a broken client or a DoS
  // attempt). Because it only *permits* the server to ignore or reject such
  // requests, every server response is conformant, so there is no
  // non-conformant condition to detect. The companion request-side rules
  // (client-should-list-multiple-ranges-in-ascending-order,
  // client-should-not-request-inefficient-multiple-ranges) already surface the
  // suspicious client behavior this permission responds to.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A server that supports range requests MAY ignore or reject a Range header field that contains an invalid ranges-specifier, a ranges-specifier with more than two overlapping ranges, or a set of many small ranges that are not listed in ascending order, since these are indications of either a broken client or a deliberate denial-of-service attack.',
  )
  .summary(
    'Server may reject Range headers with invalid specifiers, overlapping ranges, or unordered small ranges as potential DoS attacks.',
  )
  .appliesTo('server')
  .done();
