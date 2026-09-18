import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-coalesce-overlapping-or-small-gapped-ranges',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#112',
    'A server that takes this up returns fewer parts than the Range header asked for, each spanning a merged extent. Telling those apart from the range-specs requested needs the multipart/byteranges body parsed into its parts, which the framework does not expose.',
  )
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'When multiple ranges are requested, a server MAY coalesce any of the ranges that overlap, or that are separated by a gap that is smaller than the overhead of sending multiple parts, regardless of the order in which the corresponding range-spec appeared in the received Range header field.',
  )
  .appliesTo('server')
  .done();
