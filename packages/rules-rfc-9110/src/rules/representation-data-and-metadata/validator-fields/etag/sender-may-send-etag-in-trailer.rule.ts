import { not, responseTrailer, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-may-send-etag-in-trailer')
  .severity('hint')
  .type('test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `A sender MAY send the ETag field in a trailer section. However, since trailers are often ignored, it is
    preferable to send ETag as a header field unless the entity tag is generated while sending the content.`,
  )
  .summary(
    'Servers MAY send ETag in trailer section (but header field is preferable).',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCodeRange(200, 299),
      not(responseTrailer('etag')),
    ),
  )
  .done();
