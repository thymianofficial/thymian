import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/cache-or-intermediary-may-ignore-if-unmodified-since',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A cache or intermediary MAY ignore If-Unmodified-Since because its interoperability features are only necessary for an origin server.',
  )
  .summary('Cache or intermediary MAY ignore If-Unmodified-since header field.')
  .appliesTo('cache', 'intermediary')
  .tags('conditional-requests', 'if-unmodified-since', 'cache')
  .done();
