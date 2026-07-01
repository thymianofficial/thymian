import { httpRule } from '@thymian/core';

// Informational (reclassified from `analytics`): this is a purely permissive
// statement — every method other than GET and HEAD is OPTIONAL, so there is no
// non-conformant condition to detect. The previous `analytics` implementation
// flagged any non-GET/HEAD request that was NOT answered with 501 as a
// "violation", which is exactly backwards: a server is free to implement (and
// successfully answer) any other method, and rejecting one with 501 is itself
// permitted. Because nothing observable can violate an OPTIONAL, the rule
// carries no function.
export default httpRule('rfc9110/other-methods-than-get-and-head-are-optional')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('Other methods than GET and HEAD are OPTIONAL.')
  .appliesTo('server')
  .done();
