import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/etag-must-have-valid-entity-tag-format')
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server', 'origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `ETag field value must conform to: ETag = entity-tag, where entity-tag = [ weak ] opaque-tag,
    weak = %s"W/" (case-sensitive), and opaque-tag = DQUOTE *etagc DQUOTE.
    etagc = %x21 / %x23-7E / obs-text (visible characters except double quotes).
    The weak prefix "W/" is case-sensitive.`,
  )
  .summary('ETag must have valid entity-tag format with proper quoted string.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('etag'),
      (req, res, location) => {
        const etagHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('etag:'),
        );

        if (!etagHeader) {
          return false;
        }

        const value = etagHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return {
            message: 'ETag header has no value',
            location,
          };
        }

        // Check for weak prefix (case-sensitive "W/")
        let etag = value;
        let isWeak = false;

        if (etag.startsWith('W/')) {
          isWeak = true;
          etag = etag.substring(2);
        } else if (etag.toLowerCase().startsWith('w/')) {
          // Incorrect case for weak prefix
          return {
            message: `ETag weak prefix must be "W/" (case-sensitive), found "${etag.substring(0, 2)}"`,
            location,
          };
        }

        // opaque-tag must be a quoted string
        if (!etag.startsWith('"') || !etag.endsWith('"')) {
          return {
            message: `ETag opaque-tag must be a quoted string, found "${etag}"`,
            location,
          };
        }

        // Extract content between quotes
        const opaqueValue = etag.slice(1, -1);

        // etagc = %x21 / %x23-7E / obs-text
        // Essentially: any visible character except double quote (x22)
        // obs-text allows characters in range x80-xFF for compatibility
        for (let i = 0; i < opaqueValue.length; i++) {
          const charCode = opaqueValue.charCodeAt(i);
          const isValidEtagc =
            charCode === 0x21 || // !
            (charCode >= 0x23 && charCode <= 0x7e) || // # to ~
            (charCode >= 0x80 && charCode <= 0xff); // obs-text

          if (!isValidEtagc) {
            return {
              message: `ETag opaque-tag contains invalid character (code ${charCode}) at position ${i}`,
              location,
            };
          }
        }

        return false;
      },
    ),
  )
  .done();
