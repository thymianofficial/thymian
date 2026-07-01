import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-ignore-unrecognized-fields')
  .severity('warn')
  // Informational (unobservable): ignoring an unrecognized field is a non-action
  // internal to the recipient; there is no distinguishable response signal that
  // reveals whether the peer ignored a field or never saw it.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'Other recipients SHOULD ignore unrecognized header and trailer fields.',
  )
  .summary('Recipients (other than proxies) SHOULD ignore unrecognized fields.')
  .done();
