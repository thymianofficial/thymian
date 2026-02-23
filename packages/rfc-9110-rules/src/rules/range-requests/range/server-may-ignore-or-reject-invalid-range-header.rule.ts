import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-may-ignore-or-reject-invalid-range-header',
)
  .severity('hint')
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
