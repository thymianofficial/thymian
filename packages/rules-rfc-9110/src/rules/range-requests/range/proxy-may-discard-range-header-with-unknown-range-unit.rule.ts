import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-may-discard-range-header-with-unknown-range-unit',
)
  .severity('hint')
  // Informational (outcome 2): a pure "MAY" permission for a proxy — discarding an
  // unrecognized Range unit is allowed and forwarding it is equally allowed, so
  // no non-conformant condition exists. The decision is also internal to the
  // proxy and predicated on it not "understanding" the unit. Not an outcome-3
  // deferral: no violation exists to detect even with full proxy-side traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A proxy MAY discard a Range header field that contains a range unit it does not understand.',
  )
  .summary(
    'A proxy may discard a Range header field that contains a range unit it does not understand.',
  )
  .appliesTo('proxy')
  .done();
