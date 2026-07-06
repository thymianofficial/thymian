import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-process-q-parameter-as-weight',
)
  .severity('warn')
  // Constrains how the recipient internally parses a "q" parameter when
  // selecting a representation. That decision logic is not present in any HTTP
  // message, the API description, or recorded traffic, so there is nothing
  // observable to validate. The observable sender-side counterpart (parameter
  // ordering) is covered by rfc9110/sender-should-send-q-parameter-last.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept')
  .description(
    'Recipients SHOULD process any parameter named "q" as weight, regardless of parameter ordering.',
  )
  .appliesTo('server')
  .done();
