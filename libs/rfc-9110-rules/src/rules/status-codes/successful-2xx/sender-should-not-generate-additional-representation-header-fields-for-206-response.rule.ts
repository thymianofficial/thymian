import { httpRule } from '@thymian/http-linter';

import { requiredHeaders } from './server-must-generate-header-fields-for-206-response.rule.js';

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

export default httpRule(
  'rfc9110/sender-should-not-generate-additional-representation-header-fields-for-206-response'
)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-206-partial-content')
  .description(
    `A sender that generates a 206 response to a request with an If-Range header field SHOULD NOT generate other representation header fields beyond those required because the client already has a prior response containing those header fields.`
  )
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      (req, res) =>
        (req.headers.includes('if-range') && res.statusCode === 206) ||
        res.statusCode === 200,
      (req) => req.method + req.origin + req.path,
      (_, transactions) => {
        const okResponse = transactions.find(
          ([, res]) => res.statusCode === 200
        )?.[1];
        const [partialRequest, partialResponse] =
          transactions.find(([, res]) => res.statusCode === 206) ?? [];

        if (okResponse && partialResponse && partialRequest) {
          const okResponseHeaders = new Set(okResponse.headers);

          const additionalHeaders = partialResponse.headers.filter(
            (header) =>
              representationHeaderFields.includes(header) &&
              requiredHeaders.includes(header) &&
              !okResponseHeaders.has(header)
          );

          if (additionalHeaders.length > 0) {
            const transactionEdge = ctx.format.graph.findEdge(
              partialRequest.id,
              partialResponse.id,
              (id, attributes) => attributes.type === 'http-transaction'
            );

            if (!transactionEdge) {
              return;
            }

            return {
              message: `206 Partial Content response SHOULD NOT contain additional headers: ${additionalHeaders.join(
                ', '
              )}.`,
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
  .done();
