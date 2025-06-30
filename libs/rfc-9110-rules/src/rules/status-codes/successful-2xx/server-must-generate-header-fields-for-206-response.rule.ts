import { httpRule } from '@thymian/http-linter';

export const requiredHeaders = [
  'date',
  'cache-control',
  'etag',
  'expires',
  'content-location',
  'vary',
  'content-range',
];

export default httpRule(
  'rfc9110/server-must-generate-header-fields-for-206-response'
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-206-partial-content')
  .description(
    `A server that generates a 206 response MUST generate the following header fields, if the field would have been sent in a 200 (OK) response to the same request: ${requiredHeaders.join(
      ', '
    )}`
  )
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      (req, res) => res.statusCode === 200 || res.statusCode === 206,
      (req) => req.method + req.origin + req.path,
      (_, transactions) => {
        const okResponse = transactions.find(
          ([, res]) => res.statusCode === 200
        )?.[1];
        const partialResponse = transactions.find(
          ([, res]) => res.statusCode === 206
        )?.[1];

        if (okResponse && partialResponse) {
          const partialResponseHeaders = new Set(partialResponse.headers);
          const okResponseHeaders = new Set(okResponse.headers);

          return requiredHeaders.some(
            (headerName) =>
              okResponseHeaders.has(headerName) !==
              partialResponseHeaders.has(headerName)
          );
        }

        return false;
      }
    )
  )
  .done();
