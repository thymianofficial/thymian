import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-may-ignore-range-header')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up answers a request carrying Range with 200 and the whole representation rather than 206, and both the request field and the response status sit in one transaction. The `hint` — a range request was served in full, where the same section recommends supporting byte ranges — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A server MAY ignore the Range header field. However, origin servers and intermediate caches ought to support byte ranges when possible, since they support efficient recovery from partially failed transfers and partial retrieval of large representations.',
  )
  .summary('A server may ignore the Range header field.')
  .explanation(
    'The "ought to support byte ranges" note is non-normative advice, not a testable requirement.',
  )
  .appliesTo('server')
  .done();
