import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/content-language-may-be-applied-to-any-media-type',
)
  .severity('hint')
  // Informational (outcome 2): this is a permissive MAY clarifying that
  // Content-Language is not restricted to textual media types. There is no
  // non-conformant condition — applying Content-Language to any media type is
  // explicitly allowed, so nothing can be flagged.
  //
  // The previous implementation reported a violation for EVERY response that
  // merely carried a Content-Language header, i.e. it flagged perfectly
  // conformant traffic. Reclassified to informational with no rule function.
  .type('informational')
  .appliesTo('origin server')
  .description(
    'Content-Language MAY be applied to any media type -- it is not limited to textual documents.',
  )
  .summary('Content-Language MAY be applied to any media type.')
  .done();
