import { and, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-with-clock-must-not-generate-future-last-modified',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.1')
  .description(
    `An origin server with a clock MUST NOT generate a Last-Modified date that is later than the server's time of
    message origination (Date). If the last modification time is derived from implementation-specific metadata that
    evaluates to some time in the future, according to the origin server's clock, then the origin server MUST replace
    that value with the message origination date.`,
  )
  .summary(
    'Origin servers MUST NOT generate Last-Modified dates later than the Date header.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(responseHeader('last-modified'), responseHeader('date')),
      (req, res, location) => {
        // Headers are stored as a string array in the format ["name: value", ...]
        const lastModifiedHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('last-modified:'),
        );
        const dateHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('date:'),
        );

        if (!lastModifiedHeader || !dateHeader) {
          return false;
        }

        const lastModified = lastModifiedHeader.split(':', 2)[1]?.trim();
        const date = dateHeader.split(':', 2)[1]?.trim();

        if (!lastModified || !date) {
          return false;
        }

        const lastModifiedDate = new Date(lastModified);
        const dateValue = new Date(date);

        if (isNaN(lastModifiedDate.getTime()) || isNaN(dateValue.getTime())) {
          return false;
        }

        if (lastModifiedDate > dateValue) {
          return {
            message: `Last-Modified date (${lastModified}) is later than Date header (${date})`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
