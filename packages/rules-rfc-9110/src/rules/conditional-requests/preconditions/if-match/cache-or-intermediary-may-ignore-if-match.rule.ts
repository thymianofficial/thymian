import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/cache-or-intermediary-may-ignore-if-match')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A cache or intermediary MAY ignore If-Match because its interoperability features are only necessary for an origin server.',
  )
  .summary('Cache or intermediary MAY ignore If-Match header field.')
  .explanation(
    'A cache or intermediary is permitted, but not required, to skip evaluating an If-Match header and simply pass the request along instead. If-Match exists to protect against lost updates and to abort a request when the target representation has changed, and those guarantees only truly matter at the origin server that holds the authoritative representation. So a middlebox can leave the condition for the origin to enforce without violating the specification.',
  )
  .appliesTo('cache', 'intermediary')
  .rule((ctx) => ctx.validateHttpTransactions(requestHeader('if-match')))
  .done();
