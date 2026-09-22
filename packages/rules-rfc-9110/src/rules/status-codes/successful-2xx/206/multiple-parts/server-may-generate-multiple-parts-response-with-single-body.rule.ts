import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-generate-multiple-parts-response-with-single-body',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#112',
    'A server that takes this up answers a multi-range request with a multipart/byteranges body holding exactly one part. Counting the parts needs that body parsed, which the framework does not expose.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-multiple-parts')
  .description(
    'A server MAY generate a "multipart/byteranges" response with only a single body part if multiple ranges were requested and only one range was found to be satisfiable or only one range remained after coalescing.',
  )
  .appliesTo('server')
  .done();
