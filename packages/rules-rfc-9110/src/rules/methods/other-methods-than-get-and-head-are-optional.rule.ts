import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/other-methods-than-get-and-head-are-optional')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('Other methods than GET and HEAD are OPTIONAL.')
  .appliesTo('server')
  .done();
