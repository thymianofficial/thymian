import { equalsIgnoreCase } from '@thymian/core';
import {
  and,
  method,
  or,
  origin,
  path,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export const requiredHeaders = [
  'date',
  'cache-control',
  'etag',
  'expires',
  'content-location',
  'vary',
];

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
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      or(
        and(statusCode(200), responseWith(statusCode(206))),
        and(statusCode(206), responseWith(statusCode(200))),
      ),
      and(method(), origin(), path()),
      (_, transactions) => {
        const okResponse = transactions.find(
          ([, res]) => res.statusCode === 200,
        )?.[1];
        const [partialRequest, partialResponse, partialTransactionLocation] =
          transactions.find(([, res]) => res.statusCode === 206) ?? [];

        if (
          okResponse &&
          partialResponse &&
          partialRequest &&
          partialTransactionLocation
        ) {
          const missingHeaders = requiredHeaders.filter(
            (headerName) =>
              equalsIgnoreCase(headerName, ...okResponse.headers) !==
              equalsIgnoreCase(headerName, ...partialResponse.headers),
          );

          if (missingHeaders.length > 0) {
            return {
              message: `206 Partial Content response MUST contain header${
                missingHeaders.length > 1 ? 's' : ''
              } ${missingHeaders
                .map((h) => `"${h}"`)
                .join(', ')}, as the corresponding 200 OK responses contained ${
                missingHeaders.length > 1 ? 'these headers' : 'this header'
              }.`,
              location: partialTransactionLocation,
            };
          }
        }

        return;
      },
    ),
  )
  .done();
