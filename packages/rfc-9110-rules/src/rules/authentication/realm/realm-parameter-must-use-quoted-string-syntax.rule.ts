import { or, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { getRawParameterValue } from '../utils/auth-parser.js';

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

export default httpRule('rfc9110/realm-parameter-must-use-quoted-string-syntax')
  .severity('error')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.5')
  .description(
    'Servers and proxies must use quoted-string syntax (not token syntax) for realm parameter values in WWW-Authenticate and Proxy-Authenticate headers.',
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
          const rawRealm = getRawParameterValue(wwwAuth, 'realm');
          if (rawRealm && !rawRealm.startsWith('"')) {
            return true; // realm parameter exists but is not quoted
          }
        }

        // Check Proxy-Authenticate header
        const proxyAuth = getHeaderValue(
          response.headers,
          'proxy-authenticate',
        );
        if (proxyAuth) {
          const rawRealm = getRawParameterValue(proxyAuth, 'realm');
          if (rawRealm && !rawRealm.startsWith('"')) {
            return true; // realm parameter exists but is not quoted
          }
        }

        return false;
      },
    ),
  )
  .done();
