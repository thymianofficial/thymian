import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-treat-x-gzip-as-gzip')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.3')
  .description(
    `The "gzip" coding is an LZ77 coding with a 32-bit Cyclic Redundancy Check (CRC) that is commonly produced by the gzip file compression program [RFC1952]. A recipient SHOULD consider "x-gzip" to be equivalent to "gzip".`,
  )
  .summary('A recipient SHOULD consider "x-gzip" to be equivalent to "gzip".')
  .done();
