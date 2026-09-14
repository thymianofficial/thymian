import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-generate-multiple-parts-response-with-single-body',
)
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A MAY; no non-conformant condition to observe.',
  )
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A server MAY generate a "multipart/byteranges" response with only a single body part if multiple ranges were requested and only one range was found to be satisfiable or only one range remained after coalescing.',
  )
  .appliesTo('server')
  .done();
