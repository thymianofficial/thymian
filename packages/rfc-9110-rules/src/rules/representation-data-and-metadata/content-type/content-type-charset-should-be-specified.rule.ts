import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-type-charset-should-be-specified')
  .severity('hint')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.2')
  .description(
    `For text-based media types, the charset parameter should be specified to avoid ambiguity in character encoding.
    Charset names ought to be registered in the IANA "Character Sets" registry and are matched case-insensitively.
    When charset is not specified, the recipient may make assumptions based on the media type or content inspection,
    which can lead to interoperability issues.`,
  )
  .summary('Text-based Content-Type should specify charset parameter.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-type'),
      (req, res, location) => {
        const contentTypeHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('content-type:'),
        );

        if (!contentTypeHeader) {
          return false;
        }

        const value = contentTypeHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return false;
        }

        // Extract media type
        const parts = value.split(';');
        const mediaType = parts[0]?.trim().toLowerCase();

        // Check if it's a text-based type
        const isTextBased =
          mediaType?.startsWith('text/') ||
          mediaType === 'application/json' ||
          mediaType === 'application/xml' ||
          mediaType === 'application/javascript';

        if (!isTextBased) {
          return false;
        }

        // Check if charset parameter is present
        const hasCharset = parts
          .slice(1)
          .some((param) => param.trim().toLowerCase().startsWith('charset='));

        if (!hasCharset) {
          return {
            message: `Content-Type "${mediaType}" is text-based but does not specify charset parameter`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
