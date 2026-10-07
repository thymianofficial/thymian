import {
  constant,
  equalsIgnoreCase,
  type GroupedCommonHttpViolationConditionFn,
  requestHeader,
} from '@thymian/core';
import {
  and,
  method,
  or,
  origin,
  path,
  responseWith,
  statusCode,
} from '@thymian/core';
import {
  httpRule,
  type RuleFnResult,
  type RuleViolation,
  singleTestCase,
} from '@thymian/core';

export const requiredHeaders = [
  'date',
  'cache-control',
  'etag',
  'expires',
  'content-location',
  'vary',
];

// A header is only required on the 206 if the 200 for the same request
// carried it; a header present on the 206 alone is not this rule's concern.
function checkHeaders(
  okResponseHeaders: string[],
  partialResponseHeaders: string[],
): RuleViolation | undefined {
  const missingHeaders = requiredHeaders.filter(
    (headerName) =>
      equalsIgnoreCase(headerName, ...okResponseHeaders) &&
      !equalsIgnoreCase(headerName, ...partialResponseHeaders),
  );

  if (missingHeaders.length === 0) {
    return undefined;
  }

  return {
    message: `206 Partial Content response MUST contain header${
      missingHeaders.length > 1 ? 's' : ''
    } ${missingHeaders
      .map((h) => `"${h}"`)
      .join(', ')}, as the corresponding 200 OK responses contained ${
      missingHeaders.length > 1 ? 'these headers' : 'this header'
    }.`,
  };
}

const violatedWhen: GroupedCommonHttpViolationConditionFn = (
  _,
  transactions,
) => {
  const okResponse = transactions.find(
    ([, res]) => res.statusCode === 200,
  )?.[1];
  const [partialRequest, partialResponse, partialTransactionLocation] =
    transactions.find(([, res]) => res.statusCode === 206) ?? [];

  if (
    !okResponse ||
    !partialResponse ||
    !partialRequest ||
    !partialTransactionLocation
  ) {
    return [];
  }

  const violation = checkHeaders(okResponse.headers, partialResponse.headers);

  return violation
    ? [{ location: partialTransactionLocation, violation, findings: [] }]
    : [];
};

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-generate-header-fields-for-206-response',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-206-partial-content')
  .description(
    `A server that generates a 206 response MUST generate the following header fields, if the field would have been sent in a 200 (OK) response to the same request: ${requiredHeaders.join(
      ', ',
    )}`,
  )
  .explanation(
    'When a server returns 206 Partial Content, any of Date, Cache-Control, ETag, Expires, Content-Location, and Vary that it would have sent on a full 200 OK response for the same request must also appear on the partial response. These headers carry caching, validation, and content-negotiation information that stays true whether the client gets the whole body or just a range, so dropping them on the 206 would leave caches and clients unable to validate, revalidate, or correctly reuse the partial content.',
  )
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions({
      appliesTo: or(
        and(statusCode(200), responseWith(statusCode(206))),
        and(statusCode(206), responseWith(statusCode(200))),
      ),
      groupBy: and(method(), origin(), path()),
      violatedWhen,
    }),
  )
  .overrideAnalyticsRule((ctx) =>
    // responseWith() cannot be compiled to SQL, so for analytics mode
    // we broaden the filter to fetch both 200 and 206 responses for the
    // same endpoint; violatedWhen only reports once both are present.
    ctx.validateGroupedCommonHttpTransactions({
      appliesTo: or(statusCode(200), statusCode(206)),
      groupBy: and(method(), origin(), path()),
      violatedWhen,
    }),
  )
  // responseWith() cannot be answered against a single live response, so
  // test requests the described 200 and then provokes the 206 itself,
  // instead of sending a group for every 200 in the specification.
  .overrideTest(async (testContext) => {
    const results: RuleFnResult[] = [];
    await testContext.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(statusCode(200), responseWith(statusCode(206))),
        )
        .run()
        .replayStep((step) =>
          step
            .set(requestHeader('range'), constant('bytes=0-0'))
            .run({ expectStatusCode: 206 })
            .done(),
        )
        .transactions((transactions) => {
          const [okTransaction, partialTransaction] = transactions;

          const violation = checkHeaders(
            Object.keys(okTransaction.response.headers ?? {}),
            Object.keys(partialTransaction.response.headers ?? {}),
          );

          if (violation) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: partialTransaction.source.transactionId,
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
