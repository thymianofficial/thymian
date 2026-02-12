import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/content-language-must-have-valid-language-tags',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5')
  .description(
    `Content-Language field value must conform to: Content-Language = #language-tag, where language-tag
    is defined in RFC 5646 Section 2.1. Language tags are case-insensitive and consist of one or more
    case-insensitive subtags separated by hyphens. Whitespace is not allowed within a language tag.`,
  )
  .summary('Content-Language must contain valid language tags per RFC 5646.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-language'),
      (req, res, location) => {
        const contentLanguageHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('content-language:'),
        );

        if (!contentLanguageHeader) {
          return false;
        }

        const value = contentLanguageHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return {
            message: 'Content-Language header has no value',
            location,
          };
        }

        // Split by comma for multiple language tags
        const tags = value
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);

        if (tags.length === 0) {
          return {
            message: 'Content-Language has no language tags',
            location,
          };
        }

        // RFC 5646 simplified pattern: language-tag consists of subtags separated by hyphens
        // Each subtag is 1-8 alphanumeric characters
        // Full RFC 5646 is complex, this is a basic validation
        const languageTagPattern = /^[a-zA-Z0-9]{1,8}(-[a-zA-Z0-9]{1,8})*$/;

        for (const tag of tags) {
          // Check for whitespace (not allowed)
          if (/\s/.test(tag)) {
            return {
              message: `Content-Language tag "${tag}" contains whitespace (not allowed)`,
              location,
            };
          }

          if (!languageTagPattern.test(tag)) {
            return {
              message: `Content-Language tag "${tag}" does not match RFC 5646 format`,
              location,
            };
          }
        }

        return false;
      },
    ),
  )
  .done();
