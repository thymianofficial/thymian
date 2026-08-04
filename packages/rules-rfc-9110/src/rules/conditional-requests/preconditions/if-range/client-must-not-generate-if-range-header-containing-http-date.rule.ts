import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-generate-if-range-header-containing-http-date',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A client MUST NOT generate an If-Range header field containing an HTTP-date unless the client has no entity tag for the corresponding representation and the date is a strong validator in the sense defined by Section 8.8.2.2.',
  )
  .summary(
    'A client MUST NOT generate an If-Range header field containing an HTTP-date.',
  )
  .explanation(
    "If-Range lets a client resume a partial download only if the representation hasn't changed. A client should put an entity tag there whenever it has one; it may only fall back to a date when it holds no entity tag for the representation AND that date qualifies as a strong validator. Dates are a coarse way to detect change, so using one carelessly risks the server treating a modified resource as unchanged and stitching together bytes from two different versions, producing a corrupted result.",
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('if-range'),
      (req, _res, location: RuleViolationLocation) => {
        const ifRange = getHeader(req.headers, 'if-range');

        if (typeof ifRange === 'undefined') {
          return [];
        }

        const values = Array.isArray(ifRange) ? ifRange : [ifRange];

        const isViolation = values.some((value) => {
          return !value.trim().startsWith('"') && !value.startsWith('W/"');
        });

        return isViolation ? [{ location, violation: {}, findings: [] }] : [];
      },
    ),
  )
  .done();
