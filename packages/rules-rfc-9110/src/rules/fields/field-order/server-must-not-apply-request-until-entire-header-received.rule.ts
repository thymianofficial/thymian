import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-apply-request-until-entire-header-received',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'Whether a server defers applying a request until the full header section arrives is an internal timing/ordering decision with no distinguishable signal in a completed transaction that Thymian records.',
  )
  // Acting on a request before its full header section has arrived means a
  // later-arriving, deliberately misleading duplicate field could change how
  // the request is interpreted after processing already started — two points
  // in time disagreeing about what the request actually said.
  .tags('security:request-smuggling')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'A server MUST NOT apply a request to the target resource until it receives the entire request header section, since later header field lines might include conditionals, authentication credentials, or deliberately misleading duplicate header fields that could impact request processing.',
  )
  .summary(
    'Server MUST NOT apply a request until the entire request header section is received.',
  )
  .appliesTo('server')
  .done();
