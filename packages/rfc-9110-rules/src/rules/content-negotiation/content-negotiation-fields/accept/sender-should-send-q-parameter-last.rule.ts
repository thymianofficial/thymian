import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/sender-should-send-q-parameter-last')
  .severity('warn')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept')
  .summary(
    'Senders using weights SHOULD send "q" last (after all media-range parameters).',
  )
  .rule((ctx) => ctx.validateCommonHttpTransactions(requestHeader('accept')))
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('accept'), (req) => {
      const accept = getHeader(req.headers, 'accept');

      if (!accept) {
        return false;
      }

      const acceptHeaders = Array.isArray(accept) ? accept : [accept];

      const acceptValues = acceptHeaders.flatMap((header) => header.split(','));

      const malformedValues = acceptValues.filter((accept) => {
        const acceptParams = accept.split(';').map((param) => param.trim());
        const qParamIndex = acceptParams.findIndex((param) =>
          param.startsWith('q='),
        );
        return qParamIndex !== acceptParams.length - 1;
      });

      if (malformedValues.length > 0) {
        return {
          message: `The weight parameter "q" SHOULD be send as last parameter. Malformed value(s) sent: ${malformedValues.join(
            ', ',
          )}`,
        };
      }

      return false;
    }),
  )
  .done();
