import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-select-most-appropriate-choice-for-406-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends a follow-up request to one of the resource identifiers listed in the 406 content, which a captured trace carries as a later transaction. Only that follow-up is checkable — RFC 9110 defines no standard for the automatic selection, so which choice was the most appropriate one is not a verdict Thymian can reach — and it is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-406-not-acceptable')
  .description(
    'A user agent MAY automatically select the most appropriate choice from that list.',
  )
  .appliesTo('user-agent')
  .done();
