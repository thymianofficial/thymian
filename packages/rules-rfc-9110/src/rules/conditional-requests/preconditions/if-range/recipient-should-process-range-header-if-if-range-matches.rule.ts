import {
  and,
  constant,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

import { ifRangeMatchesRepresentation } from '../../utils.js';

export default httpRule(
  'rfc9110/recipient-should-process-range-header-if-if-range-matches',
)
  .severity('warn')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .appliesTo('server')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('if-range'), requestHeader('range'), statusCode(200)),
      (req, res) => {
        const ifRangeRaw = getHeader(req.headers, 'if-range');
        const ifRange = Array.isArray(ifRangeRaw) ? ifRangeRaw[0] : ifRangeRaw;
        if (!ifRange) {
          return false;
        }

        const etagRaw = getHeader(res.headers, 'etag');
        const etag = Array.isArray(etagRaw) ? etagRaw[0] : etagRaw;

        const lastModifiedRaw = getHeader(res.headers, 'last-modified');
        const lastModified = Array.isArray(lastModifiedRaw)
          ? lastModifiedRaw[0]
          : lastModifiedRaw;

        const matches = ifRangeMatchesRepresentation(
          ifRange,
          etag,
          lastModified,
        );

        return matches === true
          ? {
              message:
                'If-Range condition matched the selected representation but the server returned 200 instead of 206; it SHOULD process the Range header.',
            }
          : false;
      },
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(or(method('GET'), method('HEAD')), statusCode(200)),
        )
        .run()
        .skipIf(
          or(not(responseHeader('etag')), not(responseHeader('accept-ranges'))),
          'No ETag or server does not advertise range support',
        )
        .replayStep((step) =>
          step
            .set(requestHeader('range'), constant('bytes=0-0'))
            .set(requestHeader('if-range'), responseHeader('etag'))
            .run()
            .done(),
        )
        .expectForTransactions(statusCode(206))
        .done(),
    ),
  )
  .done();
