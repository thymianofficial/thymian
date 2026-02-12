import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-evaluate-preconditions-in-correct-order',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.2')
  .description(
    'A recipient cache or origin server MUST evaluate the request preconditions defined by this specification in the following order: 1) When recipient is the origin server and If-Match is present, evaluate the If-Match precondition; 2) When recipient is the origin server, If-Match is not present, and If-Unmodified-Since is present, evaluate the If-Unmodified-Since precondition; 3) When If-None-Match is present, evaluate the If-None-Match precondition; 4) When the method is GET or HEAD, If-None-Match is not present, and If-Modified-Since is present, evaluate the If-Modified-Since precondition; 5) When the method is GET and both Range and If-Range are present, evaluate the If-Range precondition.',
  )
  .summary(
    'Server MUST evaluate preconditions in the order: If-Match, If-Unmodified-Since, If-None-Match, If-Modified-Since, If-Range.',
  )
  .appliesTo('server', 'cache', 'origin server')
  .tags('conditional-requests', 'evaluation', 'precedence', 'order')
  .done();
