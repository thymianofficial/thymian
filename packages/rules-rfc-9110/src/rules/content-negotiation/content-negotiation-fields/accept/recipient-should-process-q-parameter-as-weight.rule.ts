import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-process-q-parameter-as-weight',
)
  .severity('warn')
  // informational: whether a recipient internally processes "q" as weight
  // is an implementation behavior that cannot be observed or validated
  // from outside the system.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept')
  .description(
    'Recipients SHOULD process any parameter named "q" as weight, regardless of parameter ordering.',
  )
  .done();
