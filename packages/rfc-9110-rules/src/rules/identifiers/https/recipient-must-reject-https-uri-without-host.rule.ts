import { protocol } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/recipient-must-reject-https-uri-without-host')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A recipient that processes a 'https' URI reference with empty host MUST reject it as invalid.`,
  )
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(protocol('https'), (req, res) => {
      try {
        return (
          new URL(req.path, req.origin).host === '' &&
          !(res.statusCode >= 400 && res.statusCode < 500)
        );
      } catch (e) {
        return false;
      }
    }),
  )
  .done();
