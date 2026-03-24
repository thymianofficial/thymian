import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-ignore-unrecognized-fields')
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'Other recipients SHOULD ignore unrecognized header and trailer fields.',
  )
  .summary('Recipients (other than proxies) SHOULD ignore unrecognized fields.')
  .tags('fields', 'field-names')
  .done();
