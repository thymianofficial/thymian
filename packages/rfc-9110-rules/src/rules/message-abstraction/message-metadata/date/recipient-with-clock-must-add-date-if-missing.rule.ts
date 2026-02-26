import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-with-clock-must-add-date-if-missing')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    "A recipient with a clock that receives a response message without a Date header field MUST record the time it was received and append a corresponding Date header field to the message's header section if it is cached or forwarded downstream.",
  )
  .summary(
    'Recipients with a clock MUST add Date header if missing when caching or forwarding.',
  )
  .done();
