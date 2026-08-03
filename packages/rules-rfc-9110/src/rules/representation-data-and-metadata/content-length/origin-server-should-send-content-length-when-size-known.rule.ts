import {
  and,
  hasResponseBody,
  not,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .explanation(
    'When a response carries content, is not using Transfer-Encoding, and the server already knows how many bytes it will send before finishing the headers, it should include a Content-Length header stating that byte count. It matters because Content-Length lets downstream recipients show transfer progress, tell when the message is complete, and safely reuse the connection for further requests; without it clients have to guess when the body ends.',
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
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'The response carries content with no Transfer-Encoding and no Content-Length header.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
