import { not, responseTrailer, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-may-send-etag-in-trailer')
  .severity('hint')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `A sender MAY send the ETag field in a trailer section. However, since trailers are often ignored, it is
    preferable to send ETag as a header field unless the entity tag is generated while sending the content.`,
  )
  .summary(
    'Servers MAY send ETag in trailer section (but header field is preferable).',
  )
  .explanation(
    'You are allowed to place the ETag in the trailer (the fields sent after the body) instead of the normal header section, which is handy when the tag is computed while streaming the content. Be aware, though, that many recipients ignore trailers entirely, so a tag delivered there may never be seen or used for caching and conditional requests. Prefer sending ETag as a regular header whenever the value is known before the body is sent.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCodeRange(200, 299),
      not(responseTrailer('etag')),
    ),
  )
  .done();
