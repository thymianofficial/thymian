import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/codings-value-may-be-given-quality-value')
  .severity('hint')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'Each codings value MAY be given an associated quality value (weight) representing the preference for that encoding, as defined in Section 12.4.2.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(requestHeader('accept-encoding')),
  )
  .done();
