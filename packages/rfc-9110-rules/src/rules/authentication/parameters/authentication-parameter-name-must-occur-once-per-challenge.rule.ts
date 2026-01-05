import { getHeader, or, requestHeader, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { parseChallenges } from '../utils/auth-parser.js';
import {
  requestAuthenticationHeaders,
  responseAuthenticationHeaders,
} from '../utils/authentication-header-names.js';

export default httpRule(
  'rfc9110/authentication-parameter-name-must-occur-once-per-challenge',
)
  .severity('error')
  .type('test', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters',
  )
  .description(
    'Authentication parameter names are matched case-insensitively and each parameter name MUST only occur once per challenge.',
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
