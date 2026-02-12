import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { hasInvalidConditionalETagSyntax } from '../../utils.js';

export default httpRule(
  'rfc9110/client-must-not-generate-invalid-if-match-syntax',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An If-Match header field with a list value containing "*" and other values (including other instances of "*") is syntactically invalid (therefore not allowed to be generated) and furthermore is unlikely to be interoperable.',
  )
  .summary(
    'Client MUST NOT generate If-Match with "*" mixed with other values.',
  )
  .appliesTo('client')
  .tags('conditional-requests', 'if-match', 'syntax')
  .rule((ctx) => ctx.validateCommonHttpTransactions(requestHeader('if-match')))
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-match'), (req) => {
      const ifMatch = getHeader(req.headers, 'if-match');

      if (typeof ifMatch !== 'string') {
        return false;
      }

      if (hasInvalidConditionalETagSyntax(ifMatch)) {
        return {
          message:
            'If-Match header contains "*" mixed with other values, which is syntactically invalid.',
        };
      }

      return false;
    }),
  )
  .done();
