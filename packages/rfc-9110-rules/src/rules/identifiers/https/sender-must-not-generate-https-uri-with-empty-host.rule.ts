import { protocol } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-not-generate-https-uri-with-empty-host',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'https' URI with an empty host identifier.`,
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      protocol('https'),
      (req) => new URL(req.path, req.origin).host === '',
    ),
  )
  .done();
