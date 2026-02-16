import {
  and,
  deleteHeader,
  not,
  or,
  requestHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule('rfc9110/server-must-ignore-if-range-without-range')
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A server MUST ignore an If-Range header field received in a request that does not contain a Range header field. An origin server MUST ignore an If-Range header field received in a request for a target resource that does not support Range requests.',
  )
  .summary('Server MUST ignore If-Range without Range header field.')
  .appliesTo('server')
  .tags('conditional-requests', 'if-range', 'range')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-range'),
        not(requestHeader('range')),
        statusCode(206),
      ),
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          or(requestHeader('if-range'), requestHeader('range')),
        )
        .mapRequest((req) => {
          deleteHeader(req.headers, 'range');

          return req;
        })
        .run()
        .done(),
    ),
  )
  .done();
