import type { HttpResponse, RuleViolationLocation } from '@thymian/core';
import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-anticipate-large-decimal-numerals-for-byte-range',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-byte-ranges')
  .description(
    'In the byte-range syntax, first-pos, last-pos, and suffix-length are expressed as decimal number of octets. Since there is no predefined limit to the length of content, recipients MUST anticipate potentially large decimal numerals and prevent parsing errors due to integer conversion overflows.',
  )
  .summary(
    'Recipients MUST anticipate potentially large decimal numerals and prevent parsing errors due to integer conversion overflows.',
  )
  .rule((ctx, _, logger) =>
    ctx.validateHttpTransactions(
      requestHeader('range'),
      (req, _res: HttpResponse, location: RuleViolationLocation) => {
        const rangeHeaders = getHeader(req.headers, 'range');

        if (!rangeHeaders) {
          return [];
        }

        const ranges = Array.isArray(rangeHeaders)
          ? rangeHeaders
          : [rangeHeaders];

        const hasLargeNumeral = ranges.some((range) => {
          const numbers = range.match(/\d+/g);

          if (!numbers) {
            return false;
          }

          return numbers.some((number) => {
            try {
              return BigInt(number) > BigInt(Number.MAX_SAFE_INTEGER);
            } catch (e) {
              logger.warn(
                `Cannot parse number in Range header to BigInt: ${e}`,
              );
              return true;
            }
          });
        });

        return hasLargeNumeral
          ? [{ location, violation: {}, findings: [] }]
          : [];
      },
    ),
  )
  .done();
