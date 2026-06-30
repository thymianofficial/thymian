import {
  and,
  type CommonHttpRequest,
  deleteHeader,
  not,
  requestHeader,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

export default httpRule('rfc9110/server-must-ignore-if-range-without-range')
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A server MUST ignore an If-Range header field received in a request that does not contain a Range header field. An origin server MUST ignore an If-Range header field received in a request for a target resource that does not support Range requests.',
  )
  .summary('Server MUST ignore If-Range without Range header field.')
  .appliesTo('server', 'origin server')
  .tags('conditional-requests', 'if-range', 'range')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-range'),
        not(requestHeader('range')),
        statusCode(206),
      ),
      (_req: CommonHttpRequest, _res, location: RuleViolationLocation) => [
        {
          location,
          violation: {
            message:
              'The request carried an If-Range header field but no Range header field, yet the server returned 206 Partial Content. A server MUST ignore If-Range when no Range header field is present.',
          },
          findings: [],
        },
      ],
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(requestHeader('if-range'), requestHeader('range')),
        )
        .mapRequest((req) => {
          deleteHeader(req.headers, 'range');

          return req;
        })
        .run()
        // With Range removed, the dangling If-Range must be ignored: the
        // response must not be a 206 Partial Content.
        .expectForTransactions(not(statusCode(206)))
        .done(),
    ),
  )
  .done();
