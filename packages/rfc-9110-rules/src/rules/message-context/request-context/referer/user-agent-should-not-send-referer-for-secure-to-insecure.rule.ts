import { and, getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-should-not-send-referer-for-secure-to-insecure',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'A user agent SHOULD NOT send a Referer header field if the referring resource was accessed with a secure protocol and the request target has an origin differing from that of the referring resource, unless the referring resource explicitly allows Referer to be sent.',
  )
  .appliesTo('user-agent')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(and(requestHeader('referer')), (request) => {
      const referer = getHeader(request.headers, 'referer');

      if (typeof referer !== 'string') {
        return false;
      }

      if (!referer?.toLowerCase().startsWith('https://')) {
        return false;
      }

      // Extract origins
      const requestUrl = request.origin.toLowerCase();
      const refererOrigin = extractOrigin(referer);
      const requestOrigin = extractOrigin(requestUrl);

      // Violation: secure referer with different origin
      return refererOrigin !== requestOrigin;
    }),
  )
  .done();

function extractOrigin(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return null;
  }
}
