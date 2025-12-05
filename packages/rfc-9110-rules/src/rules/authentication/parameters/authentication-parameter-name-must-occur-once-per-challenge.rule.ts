import { or, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import {
  hasDuplicateParameters,
  parseAuthenticationHeader,
} from '../utils/auth-parser.js';

function getHeaderValue(
  headers: string[],
  headerName: string,
): string | undefined {
  const lowerName = headerName.toLowerCase();
  for (const header of headers) {
    if (header.toLowerCase().startsWith(lowerName + ':')) {
      return header.substring(header.indexOf(':') + 1).trim();
    }
  }
  return undefined;
}

export default httpRule(
  'rfc9110/authentication-parameter-name-must-occur-once-per-challenge',
)
  .severity('error')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.2')
  .description(
    'Each authentication parameter name MUST only occur once per challenge (case-insensitive).',
  )
  .appliesTo('server', 'proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      or(
        responseHeader('www-authenticate'),
        responseHeader('proxy-authenticate'),
      ),
      (request, response) => {
        // Check WWW-Authenticate header
        const wwwAuth = getHeaderValue(response.headers, 'www-authenticate');
        if (wwwAuth) {
          const challenges = parseAuthenticationHeader(wwwAuth);
          if (
            challenges.some(
              (challenge: { parameters: Record<string, string> }) =>
                hasDuplicateParameters(challenge),
            )
          ) {
            return true;
          }
        }

        // Check Proxy-Authenticate header
        const proxyAuth = getHeaderValue(
          response.headers,
          'proxy-authenticate',
        );
        if (proxyAuth) {
          const challenges = parseAuthenticationHeader(proxyAuth);
          if (
            challenges.some(
              (challenge: { parameters: Record<string, string> }) =>
                hasDuplicateParameters(challenge),
            )
          ) {
            return true;
          }
        }

        return false;
      },
    ),
  )
  .done();
