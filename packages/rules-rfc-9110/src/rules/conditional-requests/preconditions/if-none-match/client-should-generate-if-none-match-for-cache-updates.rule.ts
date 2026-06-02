import { and, constant, origin, path } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-generate-if-none-match-for-cache-updates',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'If-None-Match is primarily used in conditional GET requests to enable efficient updates of cached information with a minimum amount of transaction overhead. When a client desires to update one or more stored responses that have entity tags, the client SHOULD generate an If-None-Match header field containing a list of those entity tags when making a GET request; this allows recipient servers to send a 304 (Not Modified) response to indicate when one of those stored responses matches the selected representation.',
  )
  .summary(
    'Client SHOULD generate If-None-Match for cache updates when stored responses have entity tags.',
  )
  .appliesTo('client')
  .tags('conditional-requests', 'if-none-match', 'cache', 'optimization')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      constant(),
      and(origin(), path()),
      (_key, txns) => {
        const groupHasEtagResponse = txns.some(([, res]) =>
          res.headers.some((h) => h === 'etag'),
        );

        if (!groupHasEtagResponse) {
          return undefined;
        }

        const getRequests = txns.filter(([req]) => req.method === 'GET');

        // Only a *re-fetch* pattern is a missed optimization: the first
        // retrieval has no stored representation yet, so omitting If-None-Match
        // is correct. Require at least two GETs to the same resource before
        // flagging, to avoid false positives on initial fetches.
        if (getRequests.length < 2) {
          return undefined;
        }

        const getWithout = getRequests.find(
          ([req]) => !req.headers.some((h) => h === 'if-none-match'),
        );

        if (!getWithout) {
          return undefined;
        }

        const [, , location] = getWithout;

        return {
          location,
          message:
            'A prior response for this resource included an ETag, but a GET request omitted If-None-Match — a missed conditional-request (cache update) optimization opportunity.',
        };
      },
    ),
  )
  .done();
