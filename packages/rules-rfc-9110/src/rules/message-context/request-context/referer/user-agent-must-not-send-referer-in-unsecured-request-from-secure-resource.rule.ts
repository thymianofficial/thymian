import {
  and,
  getHeader,
  protocol,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-not-send-referer-in-unsecured-request-from-secure-resource',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'A user agent MUST NOT send a Referer header field in an unsecured HTTP request if the referring resource was accessed with a secure protocol.',
  )
  .summary(
    'A user agent MUST NOT send a Referer referring to an https resource in an unsecured http request.',
  )
  .appliesTo('user-agent')
  .overrideAnalyticsRule((ctx) =>
    // Pre-filter to unsecured (http) requests carrying a Referer; then confirm
    // the Referer itself points at a secure (https) resource before flagging.
    ctx.validateHttpTransactions(
      and(requestHeader('referer'), protocol('http')),
      (request, _res, location: RuleViolationLocation) => {
        const referer = getHeader(request.headers, 'referer');

        if (typeof referer !== 'string') {
          return [];
        }

        // Only a Referer that names a secure (https) referring resource is a
        // violation when carried by an unsecured request. http→http is
        // conformant and must not be flagged.
        if (!referer.trim().toLowerCase().startsWith('https://')) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `An unsecured (http) request carries a Referer header referring to a secure resource (${referer.trim()}). A user agent MUST NOT leak a Referer that was accessed with a secure protocol into an unsecured request.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
