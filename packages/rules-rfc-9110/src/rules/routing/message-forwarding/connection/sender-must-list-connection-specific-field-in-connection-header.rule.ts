import { getHeader, or, requestHeader, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

/**
 * Well-known legacy fields that supply control information for/about the
 * current connection and therefore MUST be named in the Connection header
 * when present (RFC 9110 Section 7.6.1). The RFC does not enumerate such
 * fields; Keep-Alive and Proxy-Connection are the unambiguous well-known
 * cases. `Connection` itself and `Upgrade` are excluded: `Connection` is the
 * field doing the listing, and a present `Upgrade` is covered by a dedicated
 * rule.
 */
const connectionSpecificFields = ['keep-alive', 'proxy-connection'];

function connectionOptions(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => entry.split(','))
    .map((option) => option.trim().toLowerCase())
    .filter((option) => option.length > 0);
}

function headerNames(headers: Record<string, unknown> | undefined): string[] {
  return Object.keys(headers ?? {}).map((name) => name.toLowerCase());
}

export default httpRule(
  'rfc9110/sender-must-list-connection-specific-field-in-connection-header',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    'When a field aside from Connection is used to supply control information for or about the current connection, the sender MUST list the corresponding field name within the Connection header field. This enables proper hop-by-hop vs end-to-end field distinction.',
  )
  .summary('Sender MUST list connection-specific fields in Connection header.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(
        requestHeader('keep-alive'),
        responseHeader('keep-alive'),
        requestHeader('proxy-connection'),
        responseHeader('proxy-connection'),
      ),
      (req, res, location) => {
        const presentControlFields = new Set([
          ...headerNames(req.headers).filter((name) =>
            connectionSpecificFields.includes(name),
          ),
          ...headerNames(res.headers).filter((name) =>
            connectionSpecificFields.includes(name),
          ),
        ]);

        if (presentControlFields.size === 0) {
          return [];
        }

        const listedOptions = new Set([
          ...connectionOptions(getHeader(req.headers, 'connection')),
          ...connectionOptions(getHeader(res.headers, 'connection')),
        ]);

        const unlisted = Array.from(presentControlFields).filter(
          (field) => !listedOptions.has(field),
        );

        if (unlisted.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `Connection-specific control field(s) ${createList(
                unlisted,
              )} are present but not named in the Connection header.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
