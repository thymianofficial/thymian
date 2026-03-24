import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-treat-x-compress-as-compress')
  .severity('hint')
  .type('analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.1')
  .description(
    `The "compress" coding is an adaptive Lempel-Ziv-Welch (LZW) coding [Welch] that is commonly produced by the UNIX file compression program "compress". A recipient SHOULD consider "x-compress" to be equivalent to "compress".`,
  )
  .summary(
    'A recipient SHOULD consider "x-compress" to be equivalent to "compress".',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-encoding', 'x-compress'),
    ),
  )
  .done();
