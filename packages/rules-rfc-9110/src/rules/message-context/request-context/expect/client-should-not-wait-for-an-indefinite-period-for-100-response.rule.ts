import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-wait-for-an-indefinite-period-for-100-response',
)
  .severity('warn')
  // Informational (#327): a SHOULD NOT about client wait *timing*. The duration
  // a client waits before sending content is not represented in a captured
  // transaction, so the non-conformant case is unobservable. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Furthermore, since 100 (Continue) responses cannot be sent through an HTTP/1.0 intermediary, such a client SHOULD NOT wait for an indefinite period before sending the content.',
  )
  .appliesTo('client')
  .done();
