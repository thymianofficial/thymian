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
 * Only these well-known HTTP-date typed fields are inspected, to avoid
 * false-positives on unrelated fields that happen to contain whitespace.
 */
const httpDateResponseHeaders = [
  'date',
  'expires',
  'last-modified',
  'if-modified-since',
  'if-unmodified-since',
];

function headerToValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
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
  // Sender-side rule observed on the response side: the origin server is the
  // sender of these response timestamps. During `test` only the server's
  // response is observable (Thymian sends the request); during `analyze` the
  // response is present in recorded traffic. Lint is excluded because the
  // OpenAPI description does not pin concrete timestamp values. The check needs
  // header VALUES, so it uses validateHttpTransactions + getHeader rather than
  // the names-only common projection.
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'A sender MUST NOT generate additional whitespace in an HTTP-date beyond that specifically included as SP in the grammar.',
  )
  .summary(
    'Sender MUST NOT generate additional whitespace in HTTP-date beyond the grammar.',
  )
  .appliesTo('origin server')
  .tags('fields', 'date-time', 'whitespace')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(...httpDateResponseHeaders.map((name) => responseHeader(name))),
      (_req, res, location: RuleViolationLocation) => {
        const offending: string[] = [];

        for (const headerName of httpDateResponseHeaders) {
          const values = headerToValues(getHeader(res.headers, headerName));

          for (const value of values) {
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
              message: `The response carries HTTP-date field value(s) with whitespace beyond the single SP characters defined by the IMF-fixdate grammar (no HTAB, no repeated spaces, no leading/trailing whitespace are permitted). Offending field value(s): ${createList(
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
