import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/content-language-may-be-applied-to-any-media-type',
)
  .severity('hint')
  .type('analytics')
  .description(
    'Content-Language MAY be applied to any media type -- it is not limited to textual documents.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(responseHeader('content-language')),
  )
  .done();
