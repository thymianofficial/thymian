import {
  getHeader,
  or,
  requestHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .summary(
    'Each authentication parameter name MUST only occur once per challenge (matched case-insensitively).',
  )
  .appliesTo('origin server', 'proxy', 'client', 'user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(
        ...requestAuthenticationHeaders.map((h) => requestHeader(h)),
        ...responseAuthenticationHeaders.map((h) => responseHeader(h)),
      ),
      (req, res, location: RuleViolationLocation) => {
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
              // Parameter names are matched case-insensitively (RFC 9110
              // Section 11.2), so normalize before checking for duplicates.
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
      },
    ),
  )
  .done();
