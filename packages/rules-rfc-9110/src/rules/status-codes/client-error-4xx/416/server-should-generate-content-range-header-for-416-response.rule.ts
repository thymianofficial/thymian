import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-content-range-header-for-416-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-416-range-not-satisfiable',
  )
  .description(
    'A server that generates a 416 response to a byte-range request SHOULD generate a Content-Range header field specifying the current length of the selected representation.',
  )
  .explanation(
    "When a server rejects a byte-range request with 416 because the requested range does not fit the resource, it should include a Content-Range header giving the resource's current total length (for example, bytes */47022). This matters because the client asked for bytes that fall outside the resource; telling it the real size lets it recalculate a valid range and retry correctly instead of repeating the same out-of-bounds request.",
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(416),
      not(responseHeader('content-range')),
    ),
  )
  .done();
