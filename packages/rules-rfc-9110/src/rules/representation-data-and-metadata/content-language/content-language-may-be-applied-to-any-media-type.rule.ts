import {
  getHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * Extract the media type portion of a Content-Type field value (the part
 * before any ";" parameters), lower-cased for comparison.
 */
function parseMediaType(value: string): string {
  const semicolonIndex = value.indexOf(';');
  const mediaType =
    semicolonIndex === -1 ? value : value.slice(0, semicolonIndex);

  return mediaType.trim().toLowerCase();
}

export default httpRule(
  'rfc9110/content-language-may-be-applied-to-any-media-type',
)
  .severity('hint')
  .type('analytics')
  .appliesTo('origin server')
  .description(
    'Content-Language MAY be applied to any media type -- it is not limited to textual documents.',
  )
  .summary('Content-Language MAY be applied to any media type.')
  .explanation(
    'Content-Language describes the natural language of the intended audience, and you are free to attach it to anything -- an image, an audio file, a PDF -- not just plain text. It matters because the header is about who the content is for, not what format it is in, so restricting it to text/* documents would needlessly hide useful language information from clients that negotiate or filter by language.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-language'),
      (_req, res, location: RuleViolationLocation) => {
        const contentType = getHeader(res.headers, 'content-type');

        if (contentType === undefined) {
          return [];
        }

        const values = Array.isArray(contentType) ? contentType : [contentType];

        const nonTextMediaType = values
          .map(parseMediaType)
          .find((mediaType) => !mediaType.startsWith('text/'));

        if (nonTextMediaType === undefined) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The response declares Content-Language for a non-text media type ("${nonTextMediaType}").`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
