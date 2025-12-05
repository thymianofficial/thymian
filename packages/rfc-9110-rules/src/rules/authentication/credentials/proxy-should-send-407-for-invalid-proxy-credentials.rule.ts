import { and, not, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.4')
  .description(
    'Proxies requiring authentication should send 407 responses with Proxy-Authenticate header for requests with missing, invalid, or partial proxy credentials.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      // Find requests with Proxy-Authorization header that did NOT receive 407
      and(requestHeader('proxy-authorization'), not(statusCode(407))),
      // Check if response suggests authentication failure (4xx error without Proxy-Authenticate)
      (request, response) => {
        const code = response.statusCode;
        const hasProxyAuth = response.headers.includes('proxy-authenticate');

        // If it's a 4xx error (other than 407) without Proxy-Authenticate,
        // this might indicate invalid credentials should have resulted in 407
        return code >= 400 && code < 500 && !hasProxyAuth;
      },
    ),
  )
  .done();
