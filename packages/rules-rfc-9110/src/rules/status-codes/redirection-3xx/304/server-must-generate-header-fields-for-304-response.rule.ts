import { equalsIgnoreCase, url } from '@thymian/core';
import {
  and,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import {
  httpRule,
  type RuleFnResult,
  type RuleViolation,
  singleTestCase,
} from '@thymian/core';

import { createList } from '../../../../utils.js';

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
): RuleViolation | undefined {
  const missingHeaders = requiredHeadersFor304.filter(
    (header) =>
      equalsIgnoreCase(header, ...okResponseHeaders) &&
      !equalsIgnoreCase(header, ...notModifiedHeaders),
  );

  if (missingHeaders.length > 0) {
    return {
      message: `304 Not Modified response MUST include headers ${createList(
        missingHeaders,
      )} because these were included in the corresponding 200 OK response.`,
    };
  }

  return undefined;
}

export default httpRule(
  'rfc9110/server-must-generate-header-fields-for-304-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .description(
    'The server generating a 304 response MUST generate any of the following header fields that would have been sent in a 200 (OK) response to the same request: Content-Location, Date, ETag, Vary, Cache-Control, Expires.',
  )
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      and(
        or(method('GET'), method('HEAD')),
        or(statusCode(304), statusCode(200)),
      ),
      url(),
      (_, transactions) => {
        const [okResponse] =
          transactions.find(([, res]) => res.statusCode === 200) ?? [];

        const [notModifiedRequest, notModifiedResponse, notModifiedLocation] =
          transactions.find(([, res]) => res.statusCode === 304) ?? [];

        if (
          okResponse &&
          notModifiedRequest &&
          notModifiedResponse &&
          notModifiedLocation
        ) {
          const violation = checkHeaders(
            okResponse.headers,
            notModifiedResponse.headers,
          );

          if (violation) {
            return [{ location: notModifiedLocation, violation, findings: [] }];
          }
        }

        return [];
      },
    ),
  )
  .overrideTest(async (testContext) => {
    const results: RuleFnResult[] = [];
    await testContext.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(or(method('GET'), method('HEAD')), statusCode(200)),
        )
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
        .transactions((transactions) => {
          const [okTransaction, notModifiedTransaction] = transactions;

          const violation = checkHeaders(
            Object.keys(okTransaction.response.headers ?? {}),
            Object.keys(notModifiedTransaction.response.headers ?? {}),
          );

          if (violation) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: notModifiedTransaction.source.transactionId,
              },
              violation,
              findings: [],
            });
          }
        })
        .done(),
    );
    return results;
  })
  .done();
