import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-process-q-parameter-as-weight',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept')
  .description(
    'Recipients SHOULD process any parameter named "q" as weight, regardless of parameter ordering.',
  )
  .appliesTo('server')
  .done();
