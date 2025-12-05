import { and, not, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-send-401-for-invalid-credentials',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.4')
  .description(
    'Origin servers should send 401 responses with WWW-Authenticate header for requests with missing, invalid, or partial credentials.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      // Find requests with Authorization header that did NOT receive 401
      and(requestHeader('authorization'), not(statusCode(401))),
      // Check if response suggests authentication failure (4xx error without WWW-Authenticate)
      (request, response) => {
        const code = response.statusCode;
        const hasWWWAuth = response.headers.includes('www-authenticate');

        // If it's a 4xx error (other than 401) without WWW-Authenticate,
        // this might indicate invalid credentials should have resulted in 401
        return code >= 400 && code < 500 && !hasWWWAuth;
      },
    ),
  )
  .done();
