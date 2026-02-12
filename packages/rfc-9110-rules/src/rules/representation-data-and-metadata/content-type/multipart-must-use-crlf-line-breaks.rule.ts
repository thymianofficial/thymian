import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/multipart-must-use-crlf-line-breaks')
  .severity('error')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.3')
  .description(
    `For multipart types, HTTP message framing does not use the multipart boundary as an indicator of message body length.
    A sender that generates a multipart/form-data message body MUST generate only CRLF to represent line breaks between
    body parts. This ensures proper parsing and prevents ambiguity in multipart message framing.

    Note: This rule cannot be automatically validated without inspecting the actual message body content and verifying
    that line breaks use CRLF (\\r\\n) rather than LF (\\n) or other line endings. This requires deep content inspection
    beyond header analysis.`,
  )
  .summary(
    'Multipart messages MUST use CRLF for line breaks between body parts.',
  )
  .done();
