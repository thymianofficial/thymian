import {
  constant,
  getHeader,
  method,
  not,
  responseHeader,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule(
  'rfc9110/server-may-send-content-length-for-head-response',
)
  .severity('error')
  .type('test')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MAY send a Content-Length header field in a response to a HEAD request;
    a server MUST NOT send Content-Length in such a response unless its field value equals
    the decimal number of octets that would have been sent in the content of a response if
    the same request had used the GET method.`,
  )
  .summary(
    'Servers MAY send Content-Length in HEAD responses (must match what GET would return).',
  )
  .rule((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(method('head'))
        .run({ checkResponse: false })
        .skipIf(
          not(responseHeader('content-length')),
          'Content-Length header is not present in HEAD response.',
        )
        .replayStep((step) => step.set(method(), constant('get')).run().done())
        .transactions(([headTransaction, getTransaction]) => {
          const headContentLength = getHeader(
            headTransaction.response.headers,
            'content-length',
          );

          const getContentLength = getHeader(
            getTransaction.response.headers,
            'content-length',
          );

          if (
            typeof headContentLength === 'string' &&
            typeof getContentLength === 'string' &&
            headContentLength !== getContentLength
          ) {
            ctx.reportViolation({
              message: `Content-Length in HEAD response does not match GET response (${headContentLength} != ${getContentLength}).`,
              location: {
                elementType: 'edge',
                elementId: headTransaction.source.transactionId,
              },
            });
          }
        })
        .done(),
    ),
  )
  .done();
