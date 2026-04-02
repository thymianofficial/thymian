import { and, getHeader, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-may-send-accept-ranges-none')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'A server that does not support any kind of range request for the target resource MAY send "Accept-Ranges: none" to advise the client not to attempt a range request on the same request path. The range unit "none" is reserved for this purpose.',
  )
  .summary(
    'Server may send "Accept-Ranges: none" to advise against range requests.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(not(requestHeader('range'))),
      (req, res) => {
        const acceptRanges = getHeader(res.headers, 'accept-ranges');

        if (!acceptRanges) {
          return true;
        }

        return (
          Array.isArray(acceptRanges) ? acceptRanges : [acceptRanges]
        ).every((range) => !range.match(/none/i));
      },
    ),
  )
  .done();
