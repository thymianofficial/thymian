import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-should-send-validator-fields')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-200-ok')
  .description(
    `In 200 responses to GET or HEAD, an origin server SHOULD send any available validator fields for 
    the selected representation, with both a strong entity tag and a Last-Modified date being preferred.`
  )
  .summary(
    'Origin servers SHOULD send Etag or Last-Modified header in a 200 (OK) responses to GET or HEAD requests.'
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (req, res) => {
        return (
          ctx.equalsIgnoreCase(req.method, 'get', 'head') &&
          res.statusCode === 200
        );
      },
      (_, res) =>
        !(
          ctx.equalsIgnoreCase('etag', ...res.headers) ||
          ctx.equalsIgnoreCase('last-modified', ...res.headers)
        )
    )
  )
  .done();
