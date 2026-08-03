import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-send-referer-for-secure-to-insecure',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'A user agent SHOULD NOT send a Referer header field if the referring resource was accessed with a secure protocol and the request target has an origin differing from that of the referring resource, unless the referring resource explicitly allows Referer to be sent.',
  )
  .explanation(
    "When the referring page was loaded over a secure protocol and you are now requesting a resource on a different origin, you should leave the Referer off unless that referring page has explicitly opted to allow it. The Referer can expose the secure page's address, which may reveal browsing history or confidential context; withholding it across origin boundaries protects the user's privacy while still permitting same-origin analytics and back-links.",
  )
  .appliesTo('user-agent')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('referer'),
      (request, _res, location: RuleViolationLocation) => {
        const referer = getHeader(request.headers, 'referer');

        if (typeof referer !== 'string') {
          return [];
        }

        if (!referer?.toLowerCase().startsWith('https://')) {
          return [];
        }

        // Extract origins
        const requestUrl = request.origin.toLowerCase();
        const refererOrigin = extractOrigin(referer);
        const requestOrigin = extractOrigin(requestUrl);

        // Only flag when both origins parsed and differ; an unparseable origin
        // (null) must not produce a false positive.
        if (
          refererOrigin === null ||
          requestOrigin === null ||
          refererOrigin === requestOrigin
        ) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A Referer header referring to a secure resource (${referer.trim()}) was sent to a different origin (${requestOrigin}).`,
            },
            findings: [],
          },
        ];
      },
    ),
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
