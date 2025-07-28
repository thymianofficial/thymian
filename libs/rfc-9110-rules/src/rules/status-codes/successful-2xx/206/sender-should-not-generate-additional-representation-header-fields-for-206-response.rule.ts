import * as assert from 'node:assert/strict';

import { equalsIgnoreCase, getHeader, ThymianFormat } from '@thymian/core';
import {
  and,
  constant,
  or,
  requestHeader,
  responseHeader,
  responseWith,
  statusCode,
} from '@thymian/http-filter';
import { httpRule, type RuleViolation } from '@thymian/http-linter';
import {
  expect,
  filterHttpTransactions,
  generateRequests,
  mapToTestCase,
  overrideHeaders,
  overrideRequestWithPrevious,
  replayStep,
  replayStepButExpectResponse,
  runRequests,
  singleTestCase,
} from '@thymian/http-testing';

import { createList } from '../../../../utils.js';
import { requiredHeaders } from './server-must-generate-header-fields-for-206-response.rule.js';

export const representationHeaderFields = [
  // 'content-length', TODO: lets discuss these two header fields later
  // 'content-type',
  'content-range',
  'content-encoding',
  'content-location',
  'content-language',
  'etag',
  'last-modified',
];

export function arrayDifference(as: string[], bs: string[]): string[] {
  return as.filter((a) => !bs.includes(a));
}

export function checkHeaders(
  okResponseHeaders: string[],
  partialResponseHeaders: string[],
  partialRequestId: string,
  partialResponseId: string,
  format: ThymianFormat
): RuleViolation | undefined {
  const requiredFields = requiredHeaders.filter((header) =>
    equalsIgnoreCase(header, ...okResponseHeaders)
  );

  const additionalRepresentationHeaders = partialResponseHeaders.filter(
    (header) =>
      !equalsIgnoreCase(header, ...requiredFields) &&
      equalsIgnoreCase(header, ...representationHeaderFields)
  );

  // The sender generated additional representation header
  if (additionalRepresentationHeaders.length > 0) {
    const representationHeaderFromOkResponse =
      representationHeaderFields.filter((header) =>
        equalsIgnoreCase(header, ...okResponseHeaders)
      );

    const representationHeaderFromPartialResponse =
      representationHeaderFields.filter((header) =>
        equalsIgnoreCase(header, ...partialResponseHeaders)
      );

    const difference = arrayDifference(
      representationHeaderFromOkResponse,
      representationHeaderFromPartialResponse
    );
    // but if the 206 response contains ALL representation header fields that are also contained in the 200 OK response, it is specification conform
    if (difference.length === 0) {
      return;
    }

    const transactionEdge = format.graph.findEdge(
      partialRequestId,
      partialResponseId,
      (_, attributes) => attributes.type === 'http-transaction'
    );

    if (!transactionEdge) {
      return;
    }

    return {
      message: `206 Partial Content response SHOULD NOT contain additional headers ${createList(
        additionalRepresentationHeaders
      )} OR the 206 response MUST contain all representation headers, the 200 OK response also contains. Therefore the partial response is missing header(s): ${createList(
        difference
      )}.`,
      location: {
        elementType: 'edge' as const,
        elementId: transactionEdge,
      },
    };
  }

  return;
}

export default httpRule(
  'rfc9110/sender-should-not-generate-additional-representation-header-fields-for-206-response'
)
  // This rule covers 2 keywords from the specification. We therefore select the more strict keyword as the severity.
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-206-partial-content')
  .description(
    'A sender that generates a 206 response to a request with an If-Range header field SHOULD NOT generate other representation header fields beyond those required because the client already has a prior response containing those header fields. Otherwise, a sender MUST generate all of the representation header fields that would have been sent in a 200 (OK) response to the same request.'
  )
  .summary(
    'A sender SHOULD NOT sent additional representation header fields or MUST generate all representation headers for a 206 Partial Content response.'
  )
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      /*
      (req, res) =>
        (equalsIgnoreCase('if-range', ...req.headers) &&
          res.statusCode === 206) ||
        res.statusCode === 200,
       */
      or(statusCode(200), and(statusCode(206), requestHeader('if-range'))),
      (req) => req.method + req.origin + req.path,
      (_, transactions) => {
        const okResponse = transactions.find(
          ([, res]) => res.statusCode === 200
        )?.[1];
        const [partialRequest, partialResponse] =
          transactions.find(([, res]) => res.statusCode === 206) ?? [];

        if (okResponse && partialResponse && partialRequest) {
          return checkHeaders(
            okResponse.headers,
            partialResponse.headers,
            partialRequest.id,
            partialResponse.id,
            ctx.format
          );
        }

        return;
      }
    )
  )
  // TODO: let's think about later, if we should include this test
  .overrideTest((testContext) =>
    testContext.httpTest(
      singleTestCase()
        .forRequestsWith(
          and(
            requestHeader('if-range'),
            responseWith(statusCode(200)),
            responseWith(statusCode(206))
          )
        )
        .forResponsesWith(statusCode(206))
        .run()
        .replayStep((step) =>
          step
            .set(requestHeader('if-range'), responseHeader('etag'))
            .run()
            .done()
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-range'), constant('"qupaya"'))
            .run({ expectStatusCode: 200 })
            .done()
        )
        .transactions((transactions) => {
          const [, partialTransactions, okTransaction] = transactions;

          const violation = checkHeaders(
            Object.keys(okTransaction.response.headers),
            Object.keys(partialTransactions.response.headers),
            partialTransactions.source.thymianReqId,
            partialTransactions.source.thymianResId,
            testContext.format
          );

          if (violation) {
            testContext.reportViolation(violation);
          }
        })
        .done()
    )
  )
  .done();
