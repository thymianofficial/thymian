import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-should-generate-rws-as-single-sp')
  .severity('warn')
  // Informational: RWS is raw required whitespace between tokens on the wire.
  // The HTTP layer normalizes field values before Thymian observes them, so
  // the sender's original RWS representation (single SP vs. a longer run of
  // SP/HTAB) is not preserved for lint, test, or analyze, nor in HAR parsed
  // headers. Nothing observable to flag. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'The RWS rule is used when at least one linear whitespace octet is required to separate field tokens. A sender SHOULD generate RWS as a single SP.',
  )
  .summary('Sender SHOULD generate required whitespace (RWS) as a single SP.')
  .done();
