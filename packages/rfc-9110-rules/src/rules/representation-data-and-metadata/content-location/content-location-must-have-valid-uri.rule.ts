import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-location-must-have-valid-uri')
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.7')
  .description(
    `Content-Location field value must conform to: Content-Location = absolute-URI / partial-URI.
    An absolute-URI includes a scheme, while a partial-URI is relative to the target URI.
    The value must be a valid URI reference.`,
  )
  .summary('Content-Location must contain a valid URI (absolute or partial).')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-location'),
      (req, res, location) => {
        const contentLocationHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('content-location:'),
        );

        if (!contentLocationHeader) {
          return false;
        }

        const value = contentLocationHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return {
            message: 'Content-Location header has no value',
            location,
          };
        }

        // Basic URI validation
        // Check for obviously invalid characters (space, newline, etc.)
        if (/[\s\r\n]/.test(value)) {
          return {
            message: `Content-Location URI "${value}" contains whitespace`,
            location,
          };
        }

        // Try to construct a URL if it's absolute
        if (value.includes('://')) {
          try {
            new URL(value);
          } catch (e) {
            return {
              message: `Content-Location absolute-URI "${value}" is not valid`,
              location,
            };
          }
        } else {
          // Partial URI - basic validation
          // Should start with / or be a relative path
          if (value.length === 0) {
            return {
              message: 'Content-Location partial-URI is empty',
              location,
            };
          }

          // Check for invalid URI characters
          // URIs can contain: unreserved / reserved / pct-encoded
          // This is a simplified check
          const invalidChars = /[\s<>"{}|\\^`]/;
          if (invalidChars.test(value)) {
            return {
              message: `Content-Location partial-URI "${value}" contains invalid characters`,
              location,
            };
          }
        }

        return false;
      },
    ),
  )
  .done();
