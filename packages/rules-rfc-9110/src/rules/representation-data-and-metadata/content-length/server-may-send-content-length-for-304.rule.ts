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
import { httpRule, type RuleFnResult, singleTestCase } from '@thymian/core';

export default httpRule('rfc9110/server-may-send-content-length-for-304')
  .severity('error')
  // Implementable now (outcome 1): the MAY hides a MUST NOT — if a 304 carries
  // Content-Length, its value MUST equal what a 200 to the same request would
  // have sent. This is verifiable as live server behavior: replay the request
  // as a conditional GET, obtain the 304, and compare its Content-Length to the
  // baseline 200. That needs the test-only `httpTest` replay pipeline, hence
  // `.type('test')` only (lint has no live response; analyze cannot synthesize
  // the conditional replay).
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
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
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
            results.push({
              location: {
                elementType: 'edge',
                elementId: okResponse.source.transactionId,
              },
              violation: {
                message: `Content-Length in the 304 Not Modified response does not match the 200 OK response to the same request (${okResponseLength} != ${notModifiedLength}). A server MUST NOT send Content-Length in a 304 unless it equals the octet count a 200 response would have sent.`,
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
