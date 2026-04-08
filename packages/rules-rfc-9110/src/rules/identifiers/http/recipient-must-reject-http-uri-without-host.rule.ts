import { protocol } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-must-reject-http-uri-without-host')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A recipient that processes a 'http' URI reference with empty host MUST reject it as invalid.`,
  )
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(protocol('http'), (req, res) => {
      try {
        return (
          new URL(req.path, req.origin).host === '' &&
          !(res.statusCode >= 400 && res.statusCode < 500)
        );
      } catch (e) {
        logger.error('Cannot run rule because of invalid URL:', e);
        return false;
      }
    }),
  )
  .done();
