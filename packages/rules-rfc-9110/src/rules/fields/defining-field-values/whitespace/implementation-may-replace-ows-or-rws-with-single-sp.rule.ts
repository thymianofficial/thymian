import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/implementation-may-replace-ows-or-rws-with-single-sp',
)
  .severity('off')
  // Informational: a permissive MAY (OWS/RWS may be replaced with a single SP
  // before processing/forwarding) with no non-conformant condition to detect.
  // It also concerns raw inter-token whitespace, which the HTTP layer
  // normalizes before Thymian observes parsed header values. Recorded for
  // documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as OWS or RWS MAY be replaced with a single SP before interpreting it or forwarding the message downstream.',
  )
  .summary(
    'OWS or RWS content MAY be replaced with a single SP before interpretation or forwarding.',
  )
  .done();
