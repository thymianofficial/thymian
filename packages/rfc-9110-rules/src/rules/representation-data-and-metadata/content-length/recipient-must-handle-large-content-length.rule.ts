import {
  getHeader,
  httpTransactionToLabel,
  responseHeader,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-must-handle-large-content-length')
  .severity('warn')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A recipient MUST anticipate potentially large decimal numerals and prevent parsing errors due to integer
    conversion overflows or precision loss due to integer conversion. Content-Length values should be validated
    to ensure they don't exceed reasonable limits that could cause security issues.`,
  )
  .summary(
    'Content-Length values should be checked for integer overflow risks.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-length'),
      (req, res) => {
        const contentLengthHeader = getHeader(res.headers, 'content-length');

        if (typeof contentLengthHeader !== 'string') {
          return false;
        }

        // Check for extremely large values that could cause issues
        // JavaScript Number.MAX_SAFE_INTEGER is 2^53 - 1
        // But we'll warn for values > 2^40 (1TB) as that's unusually large
        const MAX_REASONABLE_SIZE = Math.pow(2, 40); // 1 TB

        try {
          const numericValue = BigInt(contentLengthHeader);

          if (numericValue > BigInt(MAX_REASONABLE_SIZE)) {
            return {
              message: `Content-Length value ${numericValue.toString()} exceeds reasonable size limit (>1TB), potential overflow risk`,
              location: httpTransactionToLabel(req, res),
            };
          }
        } catch (e) {
          return {
            message: `Content-Length value "${contentLengthHeader}" is too large to parse safely`,
            location: httpTransactionToLabel(req, res),
          };
        }

        return false;
      },
    ),
  )
  .done();
