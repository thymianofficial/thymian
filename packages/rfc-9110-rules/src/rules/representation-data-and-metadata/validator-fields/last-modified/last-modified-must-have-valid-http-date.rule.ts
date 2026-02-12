import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/last-modified-must-have-valid-http-date')
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server', 'origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2')
  .description(
    `Last-Modified field value must conform to: Last-Modified = HTTP-date.
    HTTP-date is defined in RFC 9110 Section 5.6.7 and must be in IMF-fixdate format
    (a fixed-length subset of RFC 5322). The date must be parseable and valid.`,
  )
  .summary('Last-Modified must contain a valid HTTP-date.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('last-modified'),
      (req, res, location) => {
        const lastModifiedHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('last-modified:'),
        );

        if (!lastModifiedHeader) {
          return false;
        }

        const value = lastModifiedHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return {
            message: 'Last-Modified header has no value',
            location,
          };
        }

        // Try to parse as a date
        const date = new Date(value);

        if (isNaN(date.getTime())) {
          return {
            message: `Last-Modified value "${value}" is not a valid HTTP-date`,
            location,
          };
        }

        // Check if it roughly matches IMF-fixdate format
        // IMF-fixdate = day-name "," SP date1 SP time-of-day SP GMT
        // Example: Sun, 06 Nov 1994 08:49:37 GMT
        const imfFixdatePattern =
          /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s\d{2}\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT$/;

        if (!imfFixdatePattern.test(value)) {
          return {
            message: `Last-Modified value "${value}" should be in IMF-fixdate format (e.g., "Sun, 06 Nov 1994 08:49:37 GMT")`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
