import { getHeader, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-avoid-backslash-in-entity-tags',
)
  .severity('warn')
  .type('test', 'analytics')
  .appliesTo('origin server', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `Previously, opaque-tag was defined to be a quoted-string; thus, some recipients might perform backslash unescaping.
    Servers therefore ought to avoid backslash characters in entity tags.`,
  )
  .summary('Servers SHOULD avoid backslash characters in entity tags.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(responseHeader('etag'), (req, res) => {
      const etag = getHeader(res.headers, 'etag');

      if (typeof etag !== 'string') {
        return false;
      }

      return etag.includes('\\');
    }),
  )
  .done();
