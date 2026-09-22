import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- list-consolidation mechanics, not a disclosure-shaping decision
export default httpRule(
  'rfc9110/intermediary-may-combine-via-entries-with-identical-protocols',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'An intermediary that takes this up forwards a Via with adjacent members of one received-protocol collapsed into a single member, where one that declines passes all of them on; a multi-hop trace holds the received and the forwarded field value. Reading Via as its list members to compare the two is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An intermediary MAY combine an ordered subsequence of Via header field list members into a single member if the entries have identical received-protocol values. This can reduce header size while maintaining the essential routing information.',
  )
  .summary('Intermediary MAY combine Via entries with identical protocols.')
  .appliesTo('intermediary')
  .done();
