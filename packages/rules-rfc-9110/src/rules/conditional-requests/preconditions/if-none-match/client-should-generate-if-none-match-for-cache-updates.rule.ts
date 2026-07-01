import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). This is a client-side SHOULD that is conditional on
 * the client *desiring to update stored responses that already carry entity
 * tags* — i.e. it depends on the client's private cache state, which is not
 * present in the request and which the framework cannot observe. There is no
 * non-conformant request to detect (omitting If-None-Match is fine when the
 * client has no stored response to revalidate), and being client-side the rule
 * could never belong in `test` anyway. Documentation only.
 */
export default httpRule(
  'rfc9110/client-should-generate-if-none-match-for-cache-updates',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'If-None-Match is primarily used in conditional GET requests to enable efficient updates of cached information with a minimum amount of transaction overhead. When a client desires to update one or more stored responses that have entity tags, the client SHOULD generate an If-None-Match header field containing a list of those entity tags when making a GET request; this allows recipient servers to send a 304 (Not Modified) response to indicate when one of those stored responses matches the selected representation.',
  )
  .summary(
    'Client SHOULD generate If-None-Match for cache updates when stored responses have entity tags.',
  )
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-none-match', 'cache', 'optimization')
  .done();
