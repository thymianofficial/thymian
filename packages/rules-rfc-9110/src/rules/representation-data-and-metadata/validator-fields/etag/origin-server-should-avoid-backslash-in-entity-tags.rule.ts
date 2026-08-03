import type { RuleViolationLocation } from '@thymian/core';
import { getHeader, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-avoid-backslash-in-entity-tags',
)
  .severity('warn')
  .type('test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `Previously, opaque-tag was defined to be a quoted-string; thus, some recipients might perform backslash unescaping.
    Servers therefore ought to avoid backslash characters in entity tags.`,
  )
  .summary('Servers SHOULD avoid backslash characters in entity tags.')
  .explanation(
    'Do not put backslash characters inside the value of an ETag. Older specifications treated entity tags as quoted strings, so some recipients still try to unescape backslashes; a backslash in your tag can therefore be silently altered by such a recipient. That changes the tag the client stores and later sends back, breaking conditional requests and cache validation. Keeping tags free of backslashes avoids these mismatches across differing implementations.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('etag'),
      (_req, res, location: RuleViolationLocation) => {
        const etag = getHeader(res.headers, 'etag');

        if (etag === undefined) {
          return [];
        }

        const values = Array.isArray(etag) ? etag : [etag];

        if (!values.some((value) => value.includes('\\'))) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: 'The ETag entity tag contains a backslash.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
