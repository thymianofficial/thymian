import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-process-q-parameter-as-weight',
)
  .severity('hint')
  // Informational: this constrains the recipient's internal parsing behavior —
  // how it interprets a "q" parameter when selecting a representation. That
  // decision logic is not present in any HTTP message, the API description, or
  // recorded traffic, so it is genuinely unobservable. The previous declared-
  // but-empty `static` classification could not have validated it. (The related
  // observable, sender-side ordering, is covered by
  // rfc9110/sender-should-send-q-parameter-last.)
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept')
  .description(
    'Recipients SHOULD process any parameter named "q" as weight, regardless of parameter ordering.',
  )
  .appliesTo('server')
  .done();
