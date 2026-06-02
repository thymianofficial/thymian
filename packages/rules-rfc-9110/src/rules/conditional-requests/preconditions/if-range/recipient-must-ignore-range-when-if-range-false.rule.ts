import {
  and,
  constant,
  getHeader,
  not,
  requestHeader,
  statusCode,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

import { ifRangeMatchesRepresentation } from '../../utils.js';

export default httpRule(
  'rfc9110/recipient-must-ignore-range-when-if-range-false',
)
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .summary(
    'Recipient MUST ignore Range when If-Range condition is false; SHOULD respond with 200.',
  )
  .appliesTo('server')
  .tags('conditional-requests', 'if-range', 'range', '206')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('if-range'), requestHeader('range'), statusCode(206)),
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

        return matches === false
          ? {
              message:
                'Server responded 206 to a Range request whose If-Range condition is false (If-Range does not match the selected representation); it MUST ignore Range and respond 200.',
            }
          : false;
      },
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(requestHeader('if-match'))
        // we must set any value that would fail the If-Match condition. Let's use "qupaya" for this as it is very unlikely to be an used ETag value
        .set(requestHeader('if-range'), constant('"qupaya"'))
        .run()
        .expectForTransactions(not(statusCode(206)))
        .done(),
    ),
  )
  .done();
