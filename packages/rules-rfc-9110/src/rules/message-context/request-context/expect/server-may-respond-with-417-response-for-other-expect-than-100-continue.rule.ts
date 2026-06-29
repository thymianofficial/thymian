import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-respond-with-417-response-for-other-expect-than-100-continue',
)
  .severity('hint')
  // Informational (#327): this is a permissive MAY with no non-conformant
  // condition — a server *may* answer an unsupported Expect with 417, but it is
  // equally free to handle it another way (e.g. ignore the expectation). The
  // previous `analytics` rule treated every non-417 response to a non-
  // 100-continue Expect as a violation, which inverts the MAY and fires on
  // conformant traffic. There is no observable failure to flag, so the rule is
  // reclassified informational and ships no rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives an Expect field value containing a member other than 100-continue MAY respond with a 417 (Expectation Failed) status code to indicate that the unexpected expectation cannot be met.',
  )
  .appliesTo('server')
  .done();
