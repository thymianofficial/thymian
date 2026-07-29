import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/multiple-languages-may-be-listed-for-multiple-audiences',
)
  .severity('hint')
  .type('analytics')
  .appliesTo('origin server')
  .description(
    'Multiple languages MAY be listed for content that is intended for multiple audiences.',
  )
  .summary('Multiple languages MAY be listed in Content-Language.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(responseHeader('content-language')),
  )
  .done();
