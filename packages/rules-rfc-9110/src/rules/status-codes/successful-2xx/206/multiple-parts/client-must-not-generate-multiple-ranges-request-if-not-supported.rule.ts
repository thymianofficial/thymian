import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-must-not-generate-multiple-ranges-request-if-not-supported',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Conditioned on an internal client capability (whether it can process multipart/byteranges), which is not observable from traffic.',
  )
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A client that cannot process a "multipart/byteranges" response MUST NOT generate a request that asks for multiple ranges.',
  )
  .appliesTo('client')
  .done();
