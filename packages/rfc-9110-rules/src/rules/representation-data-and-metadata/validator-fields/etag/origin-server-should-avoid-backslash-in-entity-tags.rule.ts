import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-avoid-backslash-in-entity-tags',
)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `Previously, opaque-tag was defined to be a quoted-string; thus, some recipients might perform backslash unescaping.
    Servers therefore ought to avoid backslash characters in entity tags.`,
  )
  .summary('Servers SHOULD avoid backslash characters in entity tags.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(responseHeader('etag', /\\/)),
  )
  .done();
