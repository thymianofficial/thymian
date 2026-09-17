import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- interop aliasing, not a concern this vocabulary covers
export default httpRule('rfc9110/recipient-should-treat-x-compress-as-compress')
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'Constrains how a recipient decodes an "x-compress" coding internally (treat it as "compress"). That decoding choice is implementation-internal with no distinct wire artifact.',
  )
  .appliesTo('client', 'user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.1')
  .description(
    `The "compress" coding is an adaptive Lempel-Ziv-Welch (LZW) coding [Welch] that is commonly produced by the UNIX file compression program "compress". A recipient SHOULD consider "x-compress" to be equivalent to "compress".`,
  )
  .summary(
    'A recipient SHOULD consider "x-compress" to be equivalent to "compress".',
  )
  .done();
