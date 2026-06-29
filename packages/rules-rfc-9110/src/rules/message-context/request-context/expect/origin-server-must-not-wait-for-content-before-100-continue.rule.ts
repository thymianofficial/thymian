import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-not-wait-for-content-before-100-continue',
)
  .severity('hint')
  // Informational (#327): a MUST NOT about server *timing* (it must not delay
  // the 100 Continue until content arrives). The relative timing of the interim
  // response versus content receipt is not captured in a transaction record, so
  // the non-conformant case is unobservable. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'The origin server MUST NOT wait for the content before sending the 100 (Continue) response.',
  )
  .appliesTo('origin server')
  .done();
