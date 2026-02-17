import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-should-process-q-parameter-as-weight',
)
  .severity('warn')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept')
  .description(
    'Recipients SHOULD process any parameter named "q" as weight, regardless of parameter ordering.',
  )
  .done();
