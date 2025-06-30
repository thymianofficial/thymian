import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-shoud-resend-original-request-with-modifications-for-redirected-requests'
)
  .severity('warn')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-redirection-3xx')
  .description(
    'When automatically following a redirected request, the user agent SHOULD resend the original request message with modifications (see RFC 9110).'
  )
  .done();
