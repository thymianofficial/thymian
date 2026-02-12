import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-should-treat-x-compress-as-compress')
  .severity('hint')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.1')
  .description(
    `A recipient SHOULD consider "x-compress" to be equivalent to "compress" for compatibility with legacy implementations.
    However, servers should prefer using "compress" over "x-compress" in new implementations.`,
  )
  .summary(
    'Servers should use "compress" instead of "x-compress" (legacy compatibility).',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-encoding', /\bx-compress\b/i),
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

        if (/\bx-compress\b/i.test(value)) {
          return {
            message:
              'Content-Encoding uses "x-compress" (should use "compress" instead for better compatibility)',
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
