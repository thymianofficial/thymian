import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-wait-for-an-indefinite-period-for-100-response',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Furthermore, since 100 (Continue) responses cannot be sent through an HTTP/1.0 intermediary, such a client SHOULD NOT wait for an indefinite period before sending the content.',
  )
  .appliesTo('client')
  .done();
