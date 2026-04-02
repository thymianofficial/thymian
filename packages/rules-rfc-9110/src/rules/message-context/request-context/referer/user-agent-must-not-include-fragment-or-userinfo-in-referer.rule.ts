import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-not-include-fragment-or-userinfo-in-referer',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'A user agent MUST NOT include the fragment and userinfo components of the URI reference, if any, when generating the Referer field value.',
  )
  .appliesTo('user-agent')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('referer'), (request) => {
      const referer = getHeader(request.headers, 'referer');
      if (typeof referer !== 'string') {
        return false;
      }

      // Check for fragment (#)
      if (referer.includes('#')) {
        return true;
      }

      // Check for userinfo (username:password@ or username@)
      // Userinfo appears before the host in URLs like: http://user:pass@host/path
      try {
        const url = new URL(referer);
        // URL.username or URL.password being non-empty indicates userinfo presence
        if (url.username || url.password) {
          return true;
        }
      } catch {
        // If URL parsing fails, check for @ before the first / after ://
        const match = referer.match(/^[^:]+:\/\/([^/]+)/);
        if (match && match[1]?.includes('@')) {
          return true;
        }
      }

      return false;
    }),
  )
  .done();
