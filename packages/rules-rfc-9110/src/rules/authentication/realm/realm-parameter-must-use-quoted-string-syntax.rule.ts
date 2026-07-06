import {
  equalsIgnoreCase,
  getHeader,
  or,
  requestHeader,
  responseHeader,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { parseChallenges } from '../utils/auth-parser.js';
import {
  requestAuthenticationHeaders,
  responseAuthenticationHeaders,
} from '../utils/authentication-header-names.js';

/**
 * Scans a set of authentication header field values for a `realm` parameter
 * that uses token syntax instead of the required quoted-string syntax.
 * Returns a single violation on the first occurrence.
 */
function scanForTokenSyntaxRealm(
  headerValues: string[],
  location: RuleViolationLocation,
): RuleFnResult[] {
  for (const headerValue of headerValues) {
    const challenges = parseChallenges(headerValue);
    for (const challenge of challenges) {
      for (const param of challenge.parameters) {
        const isRealmParam = equalsIgnoreCase(param.name, 'realm');
        if (isRealmParam && !param.isQuoted) {
          return [
            {
              location,
              violation: {
                message: `The realm parameter uses token syntax (realm=${param.value}) but for historical reasons a sender MUST only generate the quoted-string syntax for realm parameter values (realm="${param.value}").`,
              },
              findings: [],
            },
          ];
        }
      }
    }
  }
  return [];
}

export default httpRule('rfc9110/realm-parameter-must-use-quoted-string-syntax')
  .severity('error')
  // The quoted-string requirement binds every *sender* of a `realm`
  // auth-param: servers generating challenges (WWW-Authenticate /
  // Proxy-Authenticate) and clients whose credentials carry the realm (e.g.
  // the Digest scheme repeats `realm` in Authorization, RFC 7616). Split by
  // context so each side is validated only where it is observable:
  //   - `test`: Thymian generates the request, so only the server-generated
  //     RESPONSE challenges are meaningful; a request-side scan would be inert
  //     (the request is always well-formed).
  //   - `analytics`: recorded traffic carries real request AND response header
  //     values, so BOTH directions are validated.
  .type('test', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'For historical reasons, a sender MUST only generate the quoted-string syntax for realm parameter values.',
  )
  .summary(
    'A sender MUST only generate the quoted-string syntax for realm parameter values.',
  )
  // In `test` only the RESPONSE side is observable: the request is
  // Thymian-generated and always well-formed, so a request-side scan is inert.
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      or(...responseAuthenticationHeaders.map((h) => responseHeader(h))),
      (_req, res, location: RuleViolationLocation) =>
        scanForTokenSyntaxRealm(
          responseAuthenticationHeaders.flatMap(
            (header) => getHeader(res.headers, header) ?? [],
          ),
          location,
        ),
    ),
  )
  // In `analytics` both request-side credentials and response-side challenges
  // carry real header values, so both directions are validated.
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      or(
        ...requestAuthenticationHeaders.map((h) => requestHeader(h)),
        ...responseAuthenticationHeaders.map((h) => responseHeader(h)),
      ),
      (req, res, location: RuleViolationLocation) =>
        scanForTokenSyntaxRealm(
          [
            ...requestAuthenticationHeaders.flatMap(
              (header) => getHeader(req.headers, header) ?? [],
            ),
            ...responseAuthenticationHeaders.flatMap(
              (header) => getHeader(res.headers, header) ?? [],
            ),
          ],
          location,
        ),
    ),
  )
  .done();
