import { equalsIgnoreCase } from '@thymian/core';
import {
  and,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  responseWith,
  statusCode,
} from '@thymian/http-filter';
import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  type RuleViolation,
} from '@thymian/http-linter';
import {
  expect,
  filter,
  generateRequests,
  mapToTestCase,
  overrideHeaders,
  replayStep,
  runRequests,
  singleTestCase,
} from '@thymian/http-testing';

import { createList } from '../../../../utils.js';
import { representationFields } from '../../../fields.js';
import { requiredHeadersFor304 } from './server-must-generate-header-fields-for-304-response.rule.js';
import * as console from 'node:console';

export function checkHeaders(
  notModifiedHeaders: string[],
  transactionId: string
): RuleViolation | undefined {
  const additionalHeaders = representationFields.filter(
    (header) =>
      !equalsIgnoreCase(header, ...requiredHeadersFor304) &&
      equalsIgnoreCase(header, ...notModifiedHeaders)
  );

  if (additionalHeaders.length > 0) {
    return {
      message: `304 Not Modified response SHOULD NOT include additional headers ${createList(
        additionalHeaders
      )}.`,
      location: {
        elementType: 'edge',
        elementId: transactionId,
      },
    };
  }

  return undefined;
}

export default httpRule(
  'rfc9110/sender-should-not-generate-additional-representation-metadata-for-304-response'
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .summary('A sender SHOULD NOT generate additional representation metadata.')
  .description(
    'Since the goal of a 304 response is to minimize information transfer when the recipient already has one or more cached representations, a sender SHOULD NOT generate representation metadata other than the above listed fields unless said metadata exists for the purpose of guiding cache updates (e.g., Last-Modified might be useful if the response does not have an ETag field).'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(or(method('GET'), method('HEAD')), statusCode(304)),
      (
        req: CommonHttpRequest,
        res: CommonHttpResponse,
        transactionId: string
      ) => checkHeaders(res.headers, transactionId)
    )
  )
  .overrideTest((testContext) =>
    testContext.httpTest(
      singleTestCase()
        .forRequestsWith(
          and(or(method('GET'), method('HEAD')), responseWith(statusCode(200)))
        )
        .forResponsesWith(statusCode(200))
        .run()
        .skipIf(
          not(or(responseHeader('etag'), responseHeader('last-modified'))),
          '200 OK response does not include ETag or Last-Modified header and therefore no 304 Not Modified response can be triggered.'
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-none-match'), responseHeader('etag'))
            .set(
              requestHeader('if-modified-since'),
              responseHeader('last-modified')
            )
            .run({ expectStatusCode: 304 })
            .done()
        )
        .transactions((transactions) => {
          const [, notModifiedTransaction] = transactions;

          const violation = checkHeaders(
            Object.keys(notModifiedTransaction.response.headers ?? {}),
            notModifiedTransaction.source.transactionId
          );

          if (violation) {
            testContext.reportViolation(violation);
          }
        })
        .done()
    )
  )
  .done();
