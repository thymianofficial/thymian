import { httpRule, type RuleViolation } from '@thymian/http-linter';
import {
  expect,
  filter,
  generateRequests,
  mapToTestCase,
  overrideHeaders,
  replayStep,
  runRequests,
} from '@thymian/http-testing';

import { createList } from '../../../../utils.js';
import { and, method, or, statusCode } from '@thymian/http-filter';
import { equalsIgnoreCase } from '@thymian/core';

export const requiredHeadersFor304 = [
  'Content-Location',
  'Date',
  'ETag',
  'Vary',
  'Cache-Control',
  'Expires',
];

export function checkHeaders(
  okResponseHeaders: string[],
  notModifiedHeaders: string[],
  transactionId: string
): RuleViolation | undefined {
  const missingHeaders = requiredHeadersFor304.filter(
    (header) =>
      equalsIgnoreCase(header, ...okResponseHeaders) &&
      !equalsIgnoreCase(header, ...notModifiedHeaders)
  );

  if (missingHeaders.length > 0) {
    return {
      message: `304 Not Modified response MUST include headers ${createList(
        missingHeaders
      )} because these were included in the corresponding 200 OK response.`,
      location: {
        elementType: 'edge',
        elementId: transactionId,
      },
    };
  }

  return undefined;
}

export default httpRule(
  'rfc9110/server-must-generate-header-fields-for-304-response'
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .description(
    'The server generating a 304 response MUST generate any of the following header fields that would have been sent in a 200 (OK) response to the same request: Content-Location, Date, ETag, Vary, Cache-Control, Expires.'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      and(
        or(method('GET'), method('HEAD')),
        or(statusCode(304), statusCode(200))
      ),
      (req) => req.method + req.origin + req.path + req.mediaType,
      (_, transactions) => {
        const okResponse = transactions.find(
          ([, res]) => res.statusCode === 200
        )?.[1];
        const [notModifiedRequest, notModifiedResponse] =
          transactions.find(([, res]) => res.statusCode === 304) ?? [];

        if (okResponse && notModifiedRequest && notModifiedResponse) {
          const transactionId = ctx.format.graph.findEdge(
            notModifiedRequest.id,
            notModifiedResponse.id,
            (_, edge) => edge.type === 'http-transaction'
          );

          if (transactionId) {
            return checkHeaders(
              okResponse.headers,
              notModifiedResponse.headers,
              transactionId
            );
          }
        }

        return undefined;
      }
    )
  )
  .overrideTest((testContext) =>
    testContext.test((transactions) =>
      transactions.pipe(
        filter(
          ({ current }) =>
            equalsIgnoreCase(current.thymianReq.method, 'get', 'head') &&
            current.thymianRes.statusCode === 200
        ),
        mapToTestCase(),
        generateRequests(),
        runRequests(),
        replayStep((step) =>
          step.pipe(
            overrideHeaders((headers, testCase) => {
              const transaction = testCase.steps[0].transactions[0];

              if (!transaction) {
                throw new Error('Previous step does not have transaction.');
              }

              const etag = transaction.response?.headers['etag'];

              if (typeof etag === 'string') {
                headers['if-none-match'] = etag;
              }

              return headers;
            }),
            runRequests({ checkResponse: false })
          )
        ),
        expect(({ current }) => {
          const okTransaction = current.steps[0].transactions[0];
          const notModifiedTransaction = current.steps[1].transactions[0];

          if (
            okTransaction &&
            notModifiedTransaction &&
            notModifiedTransaction.response?.statusCode === 304
          ) {
            if (
              okTransaction.response &&
              notModifiedTransaction.response &&
              notModifiedTransaction.source?.transactionId
            ) {
              let transactionId = notModifiedTransaction.source.transactionId;

              const notModifiedResponse = testContext.format
                .getHttpResponsesOf(notModifiedTransaction.source.thymianReqId)
                .find(([, res]) => res.statusCode === 304);

              if (notModifiedResponse) {
                transactionId = notModifiedResponse[2];
              }

              const violation = checkHeaders(
                Object.keys(okTransaction.response.headers ?? {}),
                Object.keys(notModifiedTransaction.response.headers ?? {}),
                transactionId
              );

              if (violation) {
                testContext.reportViolation(violation);
              }
            }
          }
        })
      )
    )
  )
  .done();
