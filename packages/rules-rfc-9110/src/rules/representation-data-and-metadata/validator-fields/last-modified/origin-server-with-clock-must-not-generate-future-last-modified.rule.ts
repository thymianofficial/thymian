import type { RuleViolationLocation } from '@thymian/core';
import {
  and,
  getHeader,
  httpTransactionToLabel,
  responseHeader,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-with-clock-must-not-generate-future-last-modified',
)
  .severity('error')
  .type('test', 'analytics')
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
    ctx.validateHttpTransactions(
      and(responseHeader('last-modified'), responseHeader('date')),
      (req, res, _location: RuleViolationLocation) => {
        const lastModifiedHeader = getHeader(res.headers, 'last-modified');
        const dateHeader = getHeader(res.headers, 'date');

        if (
          typeof lastModifiedHeader !== 'string' ||
          typeof dateHeader !== 'string'
        ) {
          return [];
        }

        const lastModifiedDate = new Date(lastModifiedHeader);
        const dateValue = new Date(dateHeader);

        if (isNaN(lastModifiedDate.getTime()) || isNaN(dateValue.getTime())) {
          return [];
        }

        if (lastModifiedDate > dateValue) {
          return [
            {
              location: httpTransactionToLabel(req, res),
              violation: {
                message: `Last-Modified date (${lastModifiedHeader}) is later than Date header (${dateHeader})`,
              },
              findings: [],
            },
          ];
        }

        return [];
      },
    ),
  )
  .done();
