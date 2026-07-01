import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-obtain-last-modified-close-to-date-generation',
)
  .severity('off')
  // Informational: this constrains WHEN the server samples Last-Modified
  // relative to generating Date, an internal timing detail. Even with both
  // header values, the observed skew reflects real resource age, not a defect,
  // so there is no reliable violation signal; verified by code review.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.1')
  .description(
    `An origin server SHOULD obtain the Last-Modified value of the representation as close as possible to the time
    that it generates the Date field value for its response. This allows a recipient to make an accurate assessment
    of the representation's modification time, especially if the representation changes near the time that the response is generated.`,
  )
  .summary(
    'Origin servers SHOULD obtain Last-Modified close to Date generation time.',
  )
  .done();
