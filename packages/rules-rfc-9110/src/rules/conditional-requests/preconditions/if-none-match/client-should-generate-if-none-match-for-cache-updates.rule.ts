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

        const getWithout = txns.find(
          ([req]) =>
            req.method === 'GET' &&
            !req.headers.some((h) => h === 'if-none-match'),
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
