import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-should-treat-x-gzip-as-gzip')
  .severity('hint')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.3')
  .description(
    `A recipient SHOULD consider "x-gzip" to be equivalent to "gzip" for compatibility with legacy implementations.
    However, servers should prefer using "gzip" over "x-gzip" in new implementations.`,
  )
  .summary(
    'Servers should use "gzip" instead of "x-gzip" (legacy compatibility).',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-encoding', /\bx-gzip\b/i),
      (req, res, location) => {
        const contentEncodingHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('content-encoding:'),
        );

        if (!contentEncodingHeader) {
          return false;
        }

        const value = contentEncodingHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return false;
        }

        if (/\bx-gzip\b/i.test(value)) {
          return {
            message:
              'Content-Encoding uses "x-gzip" (should use "gzip" instead for better compatibility)',
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
