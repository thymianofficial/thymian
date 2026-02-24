import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-is-data-after-framing-extraction')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4')
  .description(
    'This abstract definition of content reflects the data after it has been extracted from the message framing. For example, an HTTP/1.1 message body might consist of a stream of data encoded with the chunked transfer coding -- a sequence of data chunks, one zero-length chunk, and a trailer section -- whereas the content of that same message includes only the data stream after the transfer coding has been decoded; it does not include the chunk lengths, chunked framing syntax, nor the trailer fields.',
  )
  .summary(
    'Content is the data after extraction from message framing and transfer coding.',
  )
  .done();
