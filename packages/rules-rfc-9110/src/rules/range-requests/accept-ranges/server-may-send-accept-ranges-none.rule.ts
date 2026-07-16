import {
  getHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
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
  // "Accept-Ranges: none" is a conformant MAY, so this surfaces (as analytics)
  // responses that carry an Accept-Ranges header advertising a unit other than
  // "none" (i.e. the server did not opt out of range requests), rather than
  // reporting a violation.
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('accept-ranges'),
      (_req, res, location: RuleViolationLocation) => {
        const acceptRanges = getHeader(res.headers, 'accept-ranges');
        const values = Array.isArray(acceptRanges)
          ? acceptRanges
          : acceptRanges != null
            ? [acceptRanges]
            : [];

        return !values.some((value) => value.trim().toLowerCase() === 'none')
          ? [{ location, violation: {}, findings: [] }]
          : [];
      },
    ),
  )
  .done();
