import { httpRule } from '@thymian/http-linter';

import { requiredHeaders } from './server-must-generate-header-fields-for-206-response.rule.js';
import {
  expectStatusCode,
  filter,
  forHttpTransactions,
  generateRequests,
  overrideRequestWithPrevious,
  runRequests,
  singleStepForTransaction,
  toTestCases,
} from '@thymian/http-testing';

export const representationHeaderFields = [
  'content-length',
  'content-range',
  'content-type',
  'content-encoding',
  'content-location',
  'content-language',
  'etag',
  'last-modified',
];

export function arrayDifference(as: string[], bs: string[]): string[] {
  return as.filter((a) => !bs.includes(a));
}

export default httpRule(
  'rfc9110/sender-should-not-generate-additional-representation-header-fields-for-206-response'
)
  // This rule covers 2 keywords from the specification. We therefore select the more strict keyword as the severity.
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-206-partial-content')
  .description(
    'A sender that generates a 206 response to a request with an If-Range header field SHOULD NOT generate other representation header fields beyond those required because the client already has a prior response containing those header fields. Otherwise, a sender MUST generate all of the representation header fields that would have been sent in a 200 (OK) response to the same request.'
  )
  .summary(
    'A sender SHOULD NOT sent additional representation header fields or MUST generate all representation headers for a 206 Partial Content response.'
  )
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      (req, res) =>
        (ctx.equalsIgnoreCase('if-range', ...req.headers) &&
          res.statusCode === 206) ||
        res.statusCode === 200,
      (req) => req.method + req.origin + req.path,
      (_, transactions) => {
        const okResponse = transactions.find(
          ([, res]) => res.statusCode === 200
        )?.[1];
        const [partialRequest, partialResponse] =
          transactions.find(([, res]) => res.statusCode === 206) ?? [];

        if (okResponse && partialResponse && partialRequest) {
          const requiredFields = requiredHeaders.filter((header) =>
            ctx.equalsIgnoreCase(header, ...okResponse.headers)
          );

          const additionalRepresentationHeaders =
            partialResponse.headers.filter(
              (header) =>
                !ctx.equalsIgnoreCase(header, ...requiredFields) &&
                ctx.equalsIgnoreCase(header, ...representationHeaderFields)
            );

          // The sender generated additional representation header
          if (additionalRepresentationHeaders.length > 0) {
            const representationHeaderFromOkResponse =
              representationHeaderFields.filter((header) =>
                ctx.equalsIgnoreCase(header, ...okResponse.headers)
              );

            const representationHeaderFromPartialResponse =
              representationHeaderFields.filter((header) =>
                ctx.equalsIgnoreCase(header, ...partialResponse.headers)
              );

            const difference = arrayDifference(
              representationHeaderFromOkResponse,
              representationHeaderFromPartialResponse
            );
            // but if the 206 response contains ALL representation header fields that are also contained in the 200 OK response, it is specification conform
            if (difference.length === 0) {
              return;
            }

            const transactionEdge = ctx.format.graph.findEdge(
              partialRequest.id,
              partialResponse.id,
              (id, attributes) => attributes.type === 'http-transaction'
            );

            if (!transactionEdge) {
              return;
            }

            return {
              message: `206 Partial Content response SHOULD NOT contain additional headers: ${additionalRepresentationHeaders.join(
                ', '
              )} OR the 206 response MUST contain all representation headers, the 200 OK response also contains. Missing headers: ${difference.join(
                ', '
              )}`,
              location: {
                elementType: 'edge' as const,
                elementId: transactionEdge,
              },
            };
          }
        }

        return;
      }
    )
  )
  // TODO: let's think about later, if we should include this test
  .overrideTest((ctx) =>
    ctx.test((t) =>
      t.pipe(
        forHttpTransactions(
          (req, reqId, responses) =>
            ctx.equalsIgnoreCase('if-range', ...Object.keys(req.headers)) &&
            responses.filter(
              ([, res]) => res.statusCode === 200 || res.statusCode === 206
            ).length === 2
        ),
        // we check if a request supports range requests but then first perform the normal request
        filter(({ curr }) => curr.thymianRes.statusCode === 200),
        toTestCases(),
        generateRequests(),
        runRequests(),
        singleStepForTransaction(
          (prev, format) => {
            // this node does exist
            const resId = format.graph.findOutNeighbor(
              prev.source.thymianReqId,
              (id, node) =>
                node.type === 'http-response' && node.statusCode === 206
            )!;

            return format.graph.findEdge(
              prev.source.thymianReqId,
              resId,
              (_, edge) => edge.type === 'http-transaction'
            )!;
          },
          (t) =>
            t.pipe(
              generateRequests(),
              overrideRequestWithPrevious((requestTemplate, previous) => {
                const transaction = previous.transactions[0];

                if (transaction && transaction.response) {
                  const etagHeader = transaction.response.headers['etag'];

                  if (typeof etagHeader === 'string') {
                    console.log({
                      ...requestTemplate,
                      headers: {
                        ...requestTemplate.headers,
                        'if-range': etagHeader,
                      },
                    });

                    return {
                      ...requestTemplate,
                      headers: {
                        ...requestTemplate.headers,
                        'if-range': etagHeader,
                      },
                    };
                  }
                }

                return requestTemplate;
              }),
              generateRequests(),
              runRequests(),
              expectStatusCode([206, 200])
            )
        )
      )
    )
  )
  .done();
