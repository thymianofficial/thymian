import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-may-discard-range-header-with-unknown-range-unit',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A proxy MAY discard a Range header field that contains a range unit it does not understand.',
  )
  .summary(
    'A proxy may discard a Range header field that contains a range unit it does not understand.',
  )
  .appliesTo('proxy')
  .done();
