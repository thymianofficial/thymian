import { or, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { parseChallenges } from '../utils/auth-parser.js';

export default httpRule(
  'rfc9110/authentication-parameter-name-must-occur-once-per-challenge',
)
  .severity('error')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters',
  )
  .description(
    'Authentication parameter names are matched case-insensitively and each parameter name MUST only occur once per challenge.',
  )
  .appliesTo('server', 'proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      or(
        responseHeader('www-authenticate'),
        responseHeader('proxy-authenticate'),
      ),
      (req, res) => {
        const wwwAuth = res.headers['www-authenticate'];
        const proxyAuth = res.headers['proxy-authenticate'];

        const headers = [
          ...(Array.isArray(wwwAuth) ? wwwAuth : wwwAuth ? [wwwAuth] : []),
          ...(Array.isArray(proxyAuth)
            ? proxyAuth
            : proxyAuth
              ? [proxyAuth]
              : []),
        ];

        for (const headerValue of headers) {
          const challenges = parseChallenges(headerValue);
          for (const challenge of challenges) {
            const seenParams = new Set<string>();
            for (const param of challenge.parameters) {
              const lowerName = param.name.toLowerCase();
              if (seenParams.has(lowerName)) {
                return true; // Violation found
              }
              seenParams.add(lowerName);
            }
          }
        }
        return false;
      },
    ),
  )
  .done();
