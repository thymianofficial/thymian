import {
  getHeader,
  or,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

/**
 * Well-known response header fields whose value RFC 9110 / RFC 9111 define with
 * the list (#element) construct. We restrict the check to this curated set
 * because only these are guaranteed list-typed; scanning arbitrary fields for
 * commas would misfire on values (e.g. dates) that legitimately contain them.
 * Cache-Control is intentionally excluded: its quoted-string directive
 * parameters may legally contain commas that a generic comma split would
 * misread as empty list elements.
 */
const listTypedResponseHeaders = [
  'vary',
  'allow',
  'content-encoding',
  'accept-ranges',
];

function headerToValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * A list value has an empty element when it has a leading comma, a trailing
 * comma, or two commas separated only by optional whitespace. Splitting on
 * commas and looking for an empty (whitespace-only) element captures all three.
 */
function hasEmptyListElement(value: string): boolean {
  const elements = value.split(',');
  if (elements.length < 2) {
    return false;
  }
  return elements.some((element) => element.trim() === '');
}

export default httpRule('rfc9110/sender-must-not-generate-empty-list-elements')
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In any production that uses the list construct, a sender MUST NOT generate empty list elements.',
  )
  .summary('Sender MUST NOT generate empty list elements.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(...listTypedResponseHeaders.map((name) => responseHeader(name))),
      (_req, res, location: RuleViolationLocation) => {
        const offending: string[] = [];

        for (const headerName of listTypedResponseHeaders) {
          const values = headerToValues(getHeader(res.headers, headerName));

          for (const value of values) {
            if (hasEmptyListElement(value)) {
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
              message: `The response carries a list-typed field with empty list element(s): ${createList(
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
