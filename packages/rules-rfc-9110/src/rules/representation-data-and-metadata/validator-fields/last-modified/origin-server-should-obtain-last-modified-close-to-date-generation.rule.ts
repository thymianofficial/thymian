import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-obtain-last-modified-close-to-date-generation',
)
  .severity('off')
  // Informational (outcome 2): this SHOULD is about WHEN the server samples the
  // Last-Modified value relative to generating Date — a timing property of the
  // server's internal processing. The transaction only shows the two final
  // header values; the temporal proximity of their *acquisition* is not
  // observable, and a Last-Modified that legitimately predates Date (the normal
  // case) is not a violation. No observable non-conformant condition.
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
