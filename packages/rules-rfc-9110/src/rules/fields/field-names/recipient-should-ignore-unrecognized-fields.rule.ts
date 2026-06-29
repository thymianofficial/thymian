import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-ignore-unrecognized-fields')
  .severity('warn')
  // Informational: this SHOULD describes an internal recipient behavior
  // (silently ignore unrecognized header/trailer fields). "Ignoring" produces
  // no observable signal — a conformant recipient looks identical to one that
  // never received the field — so there is nothing for lint, test, or analyze
  // to validate. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'Other recipients SHOULD ignore unrecognized header and trailer fields.',
  )
  .summary('Recipients (other than proxies) SHOULD ignore unrecognized fields.')
  .done();
