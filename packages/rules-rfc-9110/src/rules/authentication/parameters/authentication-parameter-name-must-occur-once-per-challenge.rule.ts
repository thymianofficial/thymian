import {
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
 * Scans a set of authentication header field values for a parameter name that
 * occurs more than once within a single challenge (matched case-insensitively,
 * per RFC 9110 Section 11.2). Returns a single violation on the first duplicate.
 */
function scanForDuplicateParameterNames(
  headerValues: string[],
  location: RuleViolationLocation,
): RuleFnResult[] {
  for (const headerValue of headerValues) {
    const challenges = parseChallenges(headerValue);
    for (const challenge of challenges) {
      const seenParams = new Set<string>();
      for (const param of challenge.parameters) {
        const lowerName = param.name.toLowerCase();
        if (seenParams.has(lowerName)) {
          return [
            {
              location,
              violation: {
                message: `The authentication parameter "${param.name}" occurs more than once in a single challenge of "${headerValue}". Each authentication parameter name MUST only occur once per challenge.`,
              },
              findings: [],
            },
          ];
        }
        seenParams.add(lowerName);
      }
    }
  }
  return [];
}

export default httpRule(
  'rfc9110/authentication-parameter-name-must-occur-once-per-challenge',
)
  .severity('error')
  // Implementable (outcome 1): a syntactic conformance check on the auth-param
  // syntax carried in authentication header field VALUES, read via `getHeader`.
  // It applies both to challenges (WWW-Authenticate / Proxy-Authenticate,
  // server-sent) and to credentials (Authorization / Proxy-Authorization,
  // client-sent). Split by context so each side is validated only where it is
  // observable:
  //   - `test`: Thymian generates the request, so only the server-generated
  //     RESPONSE challenges are meaningful; a request-side scan would be inert
  //     (the request is always well-formed). See overrideTest below.
  //   - `analytics`: recorded traffic carries real request AND response header
  //     values, so BOTH directions are validated. See overrideAnalyticsRule.
  .type('test', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters',
  )
  .description(
    'Authentication parameter names are matched case-insensitively and each parameter name MUST only occur once per challenge.',
  )
  .summary(
    'Each authentication parameter name MUST only occur once per challenge (matched case-insensitively).',
  )
  // Fire on HAR for both directions: response challenges (origin server /
  // proxy) and request credentials (client / user-agent).
  .appliesTo('origin server', 'proxy', 'client', 'user-agent')
  // In `test` only the RESPONSE side is observable: the request is
  // Thymian-generated and always well-formed, so a request-side scan is inert.
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      or(...responseAuthenticationHeaders.map((h) => responseHeader(h))),
      (_req, res, location: RuleViolationLocation) =>
        scanForDuplicateParameterNames(
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
        scanForDuplicateParameterNames(
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
