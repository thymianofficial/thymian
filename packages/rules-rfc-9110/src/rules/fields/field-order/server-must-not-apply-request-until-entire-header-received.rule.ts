import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-apply-request-until-entire-header-received',
)
  .severity('error')
  // Informational: this MUST constrains the server's internal processing
  // timing — it must not act on a request before the full header section is
  // received. This is an internal ordering/timing property of the server with
  // no observable signal in the completed request/response that Thymian can
  // lint, test, or analyze. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'A server MUST NOT apply a request to the target resource until it receives the entire request header section, since later header field lines might include conditionals, authentication credentials, or deliberately misleading duplicate header fields that could impact request processing.',
  )
  .summary(
    'Server MUST NOT apply a request until the entire request header section is received.',
  )
  .appliesTo('server')
  .done();
