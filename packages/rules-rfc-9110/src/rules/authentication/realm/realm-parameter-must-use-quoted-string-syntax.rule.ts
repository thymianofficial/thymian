import {
  equalsIgnoreCase,
  getHeader,
  or,
  requestHeader,
  responseHeader,
  type ThymianHttpResponse,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { parseChallenges } from '../utils/auth-parser.js';
import {
  requestAuthenticationHeaders,
  responseAuthenticationHeaders,
} from '../utils/authentication-header-names.js';

export default httpRule('rfc9110/realm-parameter-must-use-quoted-string-syntax')
  .severity('error')
  .type('test', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'For historical reasons, a sender MUST only generate the quoted-string syntax for realm parameter values.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(
        ...requestAuthenticationHeaders.map((h) => requestHeader(h)),
        ...responseAuthenticationHeaders.map((h) => responseHeader(h)),
      ),
      (req, res) => {
        const headers = [
          ...requestAuthenticationHeaders.flatMap(
            (header) => getHeader(req.headers, header) ?? [],
          ),
          ...responseAuthenticationHeaders.flatMap(
            (header) => getHeader(res.headers, header) ?? [],
          ),
        ];

        for (const headerValue of headers) {
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
