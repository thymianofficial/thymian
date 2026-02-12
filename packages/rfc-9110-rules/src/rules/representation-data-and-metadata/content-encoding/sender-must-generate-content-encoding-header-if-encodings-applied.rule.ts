import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-generate-content-encoding-header-if-encodings-applied',
)
  .severity('error')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `If one or more encodings have been applied to a representation, the sender that applied the encodings
    MUST generate a Content-Encoding header field that lists the content codings in the order in which they were applied.

    Note: This rule cannot be automatically validated because it requires knowledge of whether encoding was actually
    applied to the representation. This is an implementation-specific concern that must be verified through code review
    or by checking that responses with compressed content (detected by content patterns) include appropriate Content-Encoding headers.`,
  )
  .summary(
    'Servers MUST send Content-Encoding header listing codings in application order when encodings are applied.',
  )
  .done();
