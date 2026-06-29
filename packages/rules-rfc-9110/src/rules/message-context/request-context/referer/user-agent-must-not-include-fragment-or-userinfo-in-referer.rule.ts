import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-not-include-fragment-or-userinfo-in-referer',
)
  .severity('error')
  // Request-side, analytics-only (#327): requires the Referer *value* (only on
  // recorded traffic via the live request model). Not `test` (Thymian generates
  // the request) nor `static` (value not in the common projection).
  // Security-relevant: leaking userinfo (credentials) or a fragment in Referer
  // can expose secrets or sensitive in-page state to a third-party origin.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'A user agent MUST NOT include the fragment and userinfo components of the URI reference, if any, when generating the Referer field value.',
  )
  // Request-side: HAR requests default to the `user-agent` role.
  .appliesTo('user-agent')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('referer'),
      (request, _res, location: RuleViolationLocation) => {
        const referer = getHeader(request.headers, 'referer');
        if (typeof referer !== 'string') {
          return [];
        }

        // Check for fragment (#)
        if (referer.includes('#')) {
          return [
            {
              location,
              violation: {
                message: `The Referer header value "${referer}" contains a fragment component. A user agent MUST NOT include the fragment when generating the Referer field value.`,
              },
              findings: [],
            },
          ];
        }

        // Check for userinfo (username:password@ or username@)
        // Userinfo appears before the host in URLs like: http://user:pass@host/path
        try {
          const url = new URL(referer);
          // URL.username or URL.password being non-empty indicates userinfo presence
          if (url.username || url.password) {
            return [
              {
                location,
                violation: {
                  message: `The Referer header value "${referer}" contains a userinfo component (credentials). A user agent MUST NOT include userinfo when generating the Referer field value.`,
                },
                findings: [],
              },
            ];
          }
        } catch {
          // If URL parsing fails, check for @ before the first / after ://
          const match = referer.match(/^[^:]+:\/\/([^/]+)/);
          if (match && match[1]?.includes('@')) {
            return [
              {
                location,
                violation: {
                  message: `The Referer header value "${referer}" appears to contain a userinfo component (credentials). A user agent MUST NOT include userinfo when generating the Referer field value.`,
                },
                findings: [],
              },
            ];
          }
        }

        return [];
      },
    ),
  )
  .done();
