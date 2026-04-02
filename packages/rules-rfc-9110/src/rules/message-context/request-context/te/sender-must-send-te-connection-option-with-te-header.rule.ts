import { and, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-send-te-connection-option-with-te-header',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-te')
  .description(
    'A sender of TE MUST also send a "TE" connection option within the Connection header field to inform intermediaries not to forward this field.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('te'), not(requestHeader('connection'))),
    ),
  )
  .done();
