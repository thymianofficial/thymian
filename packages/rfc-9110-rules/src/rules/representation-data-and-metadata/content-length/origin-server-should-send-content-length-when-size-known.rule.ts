import {
  and,
  hasResponseBody,
  not,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-send-content-length-when-size-known',
)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `In the absence of Transfer-Encoding, an origin server SHOULD send a Content-Length header field
    when the content size is known prior to sending the complete header section.`,
  )
  .summary(
    'Origin servers SHOULD send Content-Length when content size is known.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        hasResponseBody(),
        not(responseHeader('transfer-encoding')),
        not(responseHeader('content-length')),
        // Exclude cases where Content-Length MUST NOT be sent
        not(statusCodeRange(100, 199)),
        not(statusCode(204)),
        not(statusCode(304)),
      ),
    ),
  )
  .done();
