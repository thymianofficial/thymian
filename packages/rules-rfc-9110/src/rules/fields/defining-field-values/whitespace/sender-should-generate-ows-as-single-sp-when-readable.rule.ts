import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-generate-ows-as-single-sp-when-readable',
)
  .severity('warn')
  // Informational: OWS is raw optional whitespace between tokens on the wire.
  // The HTTP layer parses and normalizes field values before Thymian observes
  // them, so the sender's original OWS representation (single SP vs. multiple
  // SP/HTAB) is not preserved for lint, test, or analyze; HAR parsed headers
  // likewise do not carry it. Nothing observable to flag. Recorded for
  // documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'For protocol elements where optional whitespace is preferred to improve readability, a sender SHOULD generate the optional whitespace as a single SP; otherwise, a sender SHOULD NOT generate optional whitespace except as needed to overwrite invalid or unwanted protocol elements during in-place message filtering.',
  )
  .summary(
    'Sender SHOULD generate optional whitespace (OWS) as a single SP when preferred for readability.',
  )
  .done();
