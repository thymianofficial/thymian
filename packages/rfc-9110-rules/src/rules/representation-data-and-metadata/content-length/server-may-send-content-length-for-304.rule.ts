import {
  and,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule('rfc9110/server-may-send-content-length-for-304')
  .severity('error')
  .type('test')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MAY send a Content-Length header field in a 304 (Not Modified) response to a conditional GET request;
    a server MUST NOT send Content-Length in such a response unless its field value equals the decimal number of
    octets that would have been sent in the content of a 200 (OK) response to the same request. This is useful for
    cache validation but cannot be automatically validated without access to what the 200 response would contain.`,
  )
  .summary(
    'Servers MAY send Content-Length in 304 responses if it matches what 200 would return.',
  )
  .rule((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(method('GET'), statusCode(200)))
        .run()
        .skipIf(
          not(or(responseHeader('etag'), responseHeader('last-modified'))),
          '200 OK response does not include ETag or Last-Modified header and therefore no 304 Not Modified response can be triggered.',
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-none-match'), responseHeader('etag'))
            .set(
              requestHeader('if-modified-since'),
              responseHeader('last-modified'),
            )
            .run({ expectStatusCode: 304 })
            .done(),
        )
        .transactions(([okResponse, notModifiedResponse]) => {
          const okResponseLength = getHeader(
            okResponse.response.headers,
            'content-length',
          );

          const notModifiedLength = getHeader(
            notModifiedResponse.response.headers,
            'content-length',
          );

          if (
            typeof okResponseLength === 'string' &&
            typeof notModifiedLength === 'string' &&
            okResponseLength !== notModifiedLength
          ) {
            ctx.reportViolation({
              message: `Content-Length in HEAD response does not match GET response (${okResponseLength} != ${notModifiedLength}).`,
              location: {
                elementType: 'edge',
                elementId: okResponse.source.transactionId,
              },
            });
          }
        })
        .done(),
    ),
  )
  .done();
