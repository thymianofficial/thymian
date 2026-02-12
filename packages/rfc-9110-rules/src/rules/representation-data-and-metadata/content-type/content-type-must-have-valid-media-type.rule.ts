import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-type-must-have-valid-media-type')
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `Content-Type field value must conform to: Content-Type = media-type, where media-type = type "/" subtype parameters.
    Both type and subtype are tokens. A token consists of one or more visible ASCII characters excluding separators.`,
  )
  .summary('Content-Type must have valid media-type format (type/subtype).')
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
          return {
            message: 'Content-Type header has no value',
            location,
          };
        }

        // Extract media-type (before parameters)
        const mediaType = value.split(';')[0]?.trim();

        if (!mediaType) {
          return {
            message: 'Content-Type has no media-type',
            location,
          };
        }

        // RFC 9110 token = 1*tchar
        // tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
        //         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
        const tokenPattern = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;

        // Must be type/subtype
        const parts = mediaType.split('/');
        if (parts.length !== 2) {
          return {
            message: `Content-Type media-type "${mediaType}" must be in format "type/subtype"`,
            location,
          };
        }

        const [type, subtype] = parts;

        if (!type || !tokenPattern.test(type)) {
          return {
            message: `Content-Type type "${type}" is not a valid token`,
            location,
          };
        }

        if (!subtype || !tokenPattern.test(subtype)) {
          return {
            message: `Content-Type subtype "${subtype}" is not a valid token`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
