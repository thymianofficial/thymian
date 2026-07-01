import {
  equalsIgnoreCase,
  getHeader,
  or,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { parseChallenges } from '../utils/auth-parser.js';
import { responseAuthenticationHeaders } from '../utils/authentication-header-names.js';

export default httpRule('rfc9110/realm-parameter-must-use-quoted-string-syntax')
  .severity('error')
  // Implementable (outcome 1): the `realm` auth-param is a *challenge*
  // parameter — it appears only in the server-generated WWW-Authenticate /
  // Proxy-Authenticate response headers, never in request credentials
  // (Authorization carries no `realm`). It is therefore a server-behavior
  // check: meaningful in `test` (validate the live response Thymian receives)
  // and in `analyze` (recorded traffic). The earlier implementation also
  // scanned request auth headers, which was dead code for this rule; that scan
  // has been dropped so the rule is scoped to the response challenges it
  // actually governs.
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
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(...responseAuthenticationHeaders.map((h) => responseHeader(h))),
      (_req, res, location: RuleViolationLocation) => {
        const headers = responseAuthenticationHeaders.flatMap(
          (header) => getHeader(res.headers, header) ?? [],
        );

        for (const headerValue of headers) {
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
      },
    ),
  )
  .done();
