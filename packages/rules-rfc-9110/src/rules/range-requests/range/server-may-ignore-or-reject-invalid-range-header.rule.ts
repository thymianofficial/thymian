import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-ignore-or-reject-invalid-range-header',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up answers a Range request carrying an invalid, overlapping or unordered ranges-specifier with 200 or 416 instead of the 206 it asks for, and the request field value and the response status sit in the same transaction. The `hint` — a server served a range set the specification names as the mark of a broken client or a deliberate denial-of-service attack — is not written yet.',
  )
  .tags('security:dos')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A server that supports range requests MAY ignore or reject a Range header field that contains an invalid ranges-specifier, a ranges-specifier with more than two overlapping ranges, or a set of many small ranges that are not listed in ascending order, since these are indications of either a broken client or a deliberate denial-of-service attack.',
  )
  .summary(
    'Server may reject Range headers with invalid specifiers, overlapping ranges, or unordered small ranges as potential DoS attacks.',
  )
  .explanation(
    'The companion request-side rules already surface the suspicious client behavior this permission responds to.',
  )
  .appliesTo('server')
  .done();
