import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-must-not-merge-trailers-unsafely')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1')
  .description(
    'Trailer fields can be difficult to process by intermediaries that forward messages from one protocol version to another. If the entire message can be buffered in transit, some intermediaries could merge trailer fields into the header section (as appropriate) before it is forwarded. However, in most cases, the trailers are simply discarded. A recipient MUST NOT merge a trailer field into a header section unless the recipient understands the corresponding header field definition and that definition explicitly permits and defines how trailer field values can be safely merged.',
  )
  .summary(
    'Recipients MUST NOT merge trailer fields into headers unless explicitly safe.',
  )
  .done();
