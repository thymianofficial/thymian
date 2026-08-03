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
  .explanation(
    'When content is genuinely meant for several language audiences at once -- for example a document presented side by side in Maori and English -- you may list all of those languages in Content-Language. It matters because listing every audience language lets clients that select or filter by language recognize the content as relevant, whereas naming just one would wrongly exclude the others; note this is only for multi-audience content, not text that merely happens to contain foreign words.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(responseHeader('content-language')),
  )
  .done();
