import { getHeader, or, requestHeader, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';
import { connectionOptionNames } from '../../utils/forwarding.js';

/**
 * A representative set of well-known fields that are intended for all
 * recipients of the content (end-to-end) and therefore must never appear as a
 * connection option. RFC 9110 calls out Cache-Control explicitly; the others
 * are widely understood end-to-end representation/validation/content fields. We
 * intentionally keep this to unambiguous cases to avoid false positives.
 */
const endToEndFields = new Set([
  'cache-control',
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'etag',
  'last-modified',
  'expires',
  'vary',
  'authorization',
]);

export default httpRule(
  'rfc9110/sender-must-not-send-end-to-end-fields-as-connection-options',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    'A sender MUST NOT send a connection option corresponding to a field that is intended for all recipients of the content. For example, Cache-Control is never appropriate as a connection option. This ensures end-to-end fields are not incorrectly marked as hop-by-hop.',
  )
  .summary('Sender MUST NOT use end-to-end fields as connection options.')
  .explanation(
    'The Connection header should only name fields meant for the immediate hop, never fields intended for everyone along the chain. So you must not list something like Cache-Control (or other end-to-end representation fields) as a connection option. Doing so marks an end-to-end field as hop-by-hop, causing intermediaries to strip it before it reaches its intended recipients, which breaks caching directives and other behavior the field was supposed to control across the whole path.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(requestHeader('connection'), responseHeader('connection')),
      (req, res, location) => {
        const offending = [
          ...connectionOptionNames(getHeader(req.headers, 'connection')),
          ...connectionOptionNames(getHeader(res.headers, 'connection')),
        ].filter((option) => endToEndFields.has(option));

        if (offending.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The Connection header lists option(s) ${createList(
                Array.from(new Set(offending)),
              )} that name end-to-end field(s) intended for all recipients.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
