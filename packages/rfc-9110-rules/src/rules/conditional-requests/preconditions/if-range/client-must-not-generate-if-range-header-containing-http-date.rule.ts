import { getHeader, requestHeader } from '@thymian/core';
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
  .appliesTo('client')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .rule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-range'), (req) => {
      const ifRange = getHeader(req.headers, 'if-range');

      if (typeof ifRange === 'undefined') {
        return false;
      }

      const values = Array.isArray(ifRange) ? ifRange : [ifRange];

      return values.some((value) => {
        return !value.trim().startsWith('"') && !value.startsWith('W/"');
      });
    }),
  )
  .done();
