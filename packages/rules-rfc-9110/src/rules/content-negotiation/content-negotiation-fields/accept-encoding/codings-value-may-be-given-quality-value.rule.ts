import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/codings-value-may-be-given-quality-value')
  .severity('hint')
  // Informational: this is a permissive "MAY" granting the sender the option to
  // attach a quality value to an Accept-Encoding codings value. There is no
  // condition under which a transaction is non-conformant, so no execution
  // context can produce a meaningful pass/fail. The previous `static`/
  // `analytics` classification merely flagged the presence of the request
  // header, which is noise rather than a conformance check. (Well-formedness of
  // the weight syntax is covered by separate field-syntax rules, not this one.)
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'Each codings value MAY be given an associated quality value (weight) representing the preference for that encoding, as defined in Section 12.4.2.',
  )
  .appliesTo('client', 'user-agent')
  .done();
