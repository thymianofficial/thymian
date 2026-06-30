import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/content-language-may-be-applied-to-any-media-type',
)
  .severity('hint')
  .type('informational')
  .appliesTo('origin server')
  .description(
    'Content-Language MAY be applied to any media type -- it is not limited to textual documents.',
  )
  .summary('Content-Language MAY be applied to any media type.')
  .done();
