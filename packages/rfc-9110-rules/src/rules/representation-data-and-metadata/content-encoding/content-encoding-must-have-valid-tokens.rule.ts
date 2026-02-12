import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-encoding-must-have-valid-tokens')
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server', 'client', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `Content-Encoding field value must conform to: Content-Encoding = #content-coding, where content-coding = token.
    A token consists of one or more visible ASCII characters excluding separators. All content codings are case-insensitive
    and ought to be registered within the "HTTP Content Coding Registry".`,
  )
  .summary('Content-Encoding must contain valid tokens.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-encoding'),
      (req, res, location) => {
        const contentEncodingHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('content-encoding:'),
        );

        if (!contentEncodingHeader) {
          return false;
        }

        const value = contentEncodingHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return {
            message: 'Content-Encoding header has no value',
            location,
          };
        }

        // RFC 9110 token = 1*tchar
        const tokenPattern = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;

        // Split by comma for multiple codings
        const codings = value
          .split(',')
          .map((c) => c.trim())
          .filter((c) => c);

        if (codings.length === 0) {
          return {
            message: 'Content-Encoding has no codings',
            location,
          };
        }

        for (const coding of codings) {
          if (!tokenPattern.test(coding)) {
            return {
              message: `Content-Encoding coding "${coding}" is not a valid token`,
              location,
            };
          }
        }

        return false;
      },
    ),
  )
  .done();
