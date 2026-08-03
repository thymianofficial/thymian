import {
  constant,
  getHeader,
  method,
  not,
  responseHeader,
} from '@thymian/core';
import { httpRule, type RuleFnResult, singleTestCase } from '@thymian/core';

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
  .explanation(
    "A HEAD response has no body, but a server may still send a Content-Length -- and when it does, that value must equal the number of bytes a GET on the same resource would have returned. It matters because clients use HEAD precisely to learn a resource's size before downloading it; if the advertised length differs from what GET would deliver, callers make wrong decisions about buffering, progress, or whether to fetch at all.",
  )
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
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
            results.push({
              location: {
                elementType: 'edge',
                elementId: headTransaction.source.transactionId,
              },
              violation: {
                message: `Content-Length in HEAD response does not match GET response (${headContentLength} != ${getContentLength}).`,
              },
              findings: [],
            });
          }
        })
        .done(),
    );
    return results;
  })
  .done();
