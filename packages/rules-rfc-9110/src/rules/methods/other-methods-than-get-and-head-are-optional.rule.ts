import { httpRule } from '@thymian/core';

// This is a purely permissive statement — every method other than GET and HEAD
// is OPTIONAL, so there is no non-conformant condition to detect. A server is
// free to implement (and successfully answer) any other method, and rejecting
// one with 501 is itself permitted. Nothing observable can violate an OPTIONAL.
export default httpRule('rfc9110/other-methods-than-get-and-head-are-optional')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('Other methods than GET and HEAD are OPTIONAL.')
  .appliesTo('server')
  .done();
