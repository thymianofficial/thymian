import {
  getHeader,
  or,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

/**
 * Response header fields whose value is defined as a single HTTP-date by RFC
 * 9110 / RFC 9111. Per Section 5.6.7 a sender MUST generate these timestamps in
 * the IMF-fixdate format. We restrict the check to these well-known
 * response-side fields because only they are guaranteed to be HTTP-date typed;
 * checking arbitrary fields would produce false positives on values that merely
 * resemble a date. (The conditional If-Modified-Since / If-Unmodified-Since
 * fields are request-only per RFC 9110 §13.1.3/§13.1.4 and so are not listed.)
 */
const httpDateResponseHeaders = [
  'date',
  'expires',
  'last-modified',
  'retry-after',
];

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * IMF-fixdate per RFC 9110 Section 5.6.7:
 *   IMF-fixdate = day-name "," SP date1 SP time-of-day SP GMT
 *   date1       = day SP month SP year   (day = 2DIGIT, year = 4DIGIT)
 *   time-of-day = hour ":" minute ":" second
 * The exactly-specified single SP characters are encoded literally below.
 */
const imfFixdatePattern = new RegExp(
  `^(${dayNames.join('|')}), \\d{2} (${monthNames.join('|')}) \\d{4} \\d{2}:\\d{2}:\\d{2} GMT$`,
);

function headerToValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Retry-after may be either an HTTP-date or a non-negative integer
 * (delay-seconds). Only the date form is constrained by this rule, so a purely
 * numeric value is out of scope.
 */
function isDelaySeconds(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export default httpRule(
  'rfc9110/sender-must-generate-timestamps-in-imf-fixdate-format',
)
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'When a sender generates a field that contains one or more timestamps defined as HTTP-date, the sender MUST generate those timestamps in the IMF-fixdate format.',
  )
  .summary(
    'Sender MUST generate HTTP-date timestamps in the IMF-fixdate format.',
  )
  .tags('fields', 'date-time')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(...httpDateResponseHeaders.map((name) => responseHeader(name))),
      (_req, res, location: RuleViolationLocation) => {
        const malformed: string[] = [];

        for (const headerName of httpDateResponseHeaders) {
          const values = headerToValues(getHeader(res.headers, headerName));

          for (const raw of values) {
            const value = raw.trim();

            if (!value) {
              continue;
            }

            // Retry-After accepts delay-seconds; that form is not an HTTP-date.
            if (headerName === 'retry-after' && isDelaySeconds(value)) {
              continue;
            }

            if (!imfFixdatePattern.test(value)) {
              malformed.push(`${headerName}: ${value}`);
            }
          }
        }

        if (malformed.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The response carries HTTP-date timestamp(s) not in the required IMF-fixdate format: ${createList(
                malformed,
              )}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
