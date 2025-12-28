import { equalsIgnoreCase, or, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { parseChallenges } from '../utils/auth-parser.js';

export default httpRule('rfc9110/realm-parameter-must-use-quoted-string-syntax')
  .severity('error')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'For historical reasons, a sender MUST only generate the quoted-string syntax for realm parameter values.',
  )
  .appliesTo('server', 'proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      or(
        responseHeader('www-authenticate'),
        responseHeader('proxy-authenticate'),
      ),
      (_req, res) => {
        const wwwAuth = res.headers['www-authenticate'] ?? [];
        const proxyAuth = res.headers['proxy-authenticate'] ?? [];
        const authHeaders = [
          ...(Array.isArray(wwwAuth) ? wwwAuth : [wwwAuth]),
          ...(Array.isArray(proxyAuth) ? proxyAuth : [proxyAuth]),
        ];

        for (const headerValue of authHeaders) {
          const challenges = parseChallenges(headerValue);
          for (const challenge of challenges) {
            for (const param of challenge.parameters) {
              const isRealmParam = equalsIgnoreCase(param.name, 'realm');
              if (isRealmParam && !param.isQuoted) {
                return true; // Violation: realm used token syntax instead of quoted-string
              }
            }
          }
        }
        return false;
      },
    ),
  )
  .done();
