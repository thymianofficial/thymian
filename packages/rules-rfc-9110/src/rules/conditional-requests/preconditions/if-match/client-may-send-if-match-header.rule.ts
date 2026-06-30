import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-if-match-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A client MAY send an If-Match header field in a GET request to indicate that it would prefer a 412 (Precondition Failed) response if the selected representation does not match.',
  )
  .summary('A client MAY send an If-Match header field in a GET request.')
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-match', 'cache')
  .done();
