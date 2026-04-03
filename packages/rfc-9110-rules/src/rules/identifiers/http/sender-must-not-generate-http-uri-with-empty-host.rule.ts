import { protocol } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-not-generate-http-uri-with-empty-host',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'http' URI with an empty host identifier.`,
  )
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(protocol('http'), (req) => {
      try {
        return new URL(req.path, req.origin).host === '';
      } catch (e) {
        logger.error('Cannot run rule because of invalid URL:', e);
        return false;
      }
    }),
  )
  .done();
