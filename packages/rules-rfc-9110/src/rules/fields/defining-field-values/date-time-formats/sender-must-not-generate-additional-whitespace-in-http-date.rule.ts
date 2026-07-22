import {
  getHeader,
  or,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

/**
 * Response header fields whose value is a single HTTP-date (see Section 5.6.7).
 * Only these well-known response-side HTTP-date typed fields are inspected, to
 * avoid false-positives on unrelated fields that happen to contain whitespace.
 * (The conditional If-Modified-Since / If-Unmodified-Since fields are
 * request-only per RFC 9110 §13.1.3/§13.1.4 and so are not listed.) Retry-After
 * is included because it may carry an HTTP-date; its alternative delay-seconds
 * form is skipped below.
 */
const httpDateResponseHeaders = [
  'date',
  'expires',
  'last-modified',
  'retry-after',
];

function headerToValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Retry-After may be either an HTTP-date or a non-negative integer
 * (delay-seconds). Only the date form is constrained by this rule, so a purely
 * numeric value is out of scope.
 */
function isDelaySeconds(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * The IMF-fixdate grammar specifies whitespace only as single SP characters in
 * fixed positions; any HTAB, run of multiple spaces, or leading/trailing
 * whitespace is "additional whitespace" that a sender MUST NOT generate.
 */
function hasAdditionalWhitespace(value: string): boolean {
  return /\t/.test(value) || / {2,}/.test(value) || value !== value.trim();
}

export default httpRule(
  'rfc9110/sender-must-not-generate-additional-whitespace-in-http-date',
)
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'A sender MUST NOT generate additional whitespace in an HTTP-date beyond that specifically included as SP in the grammar.',
  )
  .summary(
    'Sender MUST NOT generate additional whitespace in HTTP-date beyond the grammar.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(...httpDateResponseHeaders.map((name) => responseHeader(name))),
      (_req, res, location: RuleViolationLocation) => {
        const offending: string[] = [];

        for (const headerName of httpDateResponseHeaders) {
          const values = headerToValues(getHeader(res.headers, headerName));

          for (const value of values) {
            // Retry-After accepts delay-seconds; that form is not an HTTP-date.
            if (headerName === 'retry-after' && isDelaySeconds(value)) {
              continue;
            }

            if (value && hasAdditionalWhitespace(value)) {
              offending.push(`${headerName}: ${value}`);
            }
          }
        }

        if (offending.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The response carries HTTP-date field value(s) with additional whitespace: ${createList(
                offending,
              )}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
