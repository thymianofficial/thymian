import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { hasInvalidConditionalETagSyntax } from '../../utils.js';

export default httpRule(
  'rfc9110/client-must-not-generate-invalid-if-none-match-syntax',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'An If-None-Match header field with a list value containing "*" and other values (including other instances of "*") is syntactically invalid (therefore not allowed to be generated) and furthermore is unlikely to be interoperable.',
  )
  .summary(
    'Client MUST NOT generate If-None-Match with "*" mixed with other values.',
  )
  .appliesTo('client')
  .tags('conditional-requests', 'if-none-match', 'syntax')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(requestHeader('if-none-match')),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-none-match'), (req) => {
      const ifNoneMatch = getHeader(req.headers, 'if-none-match');

      if (typeof ifNoneMatch !== 'string') {
        return false;
      }

      if (hasInvalidConditionalETagSyntax(ifNoneMatch)) {
        return {
          message:
            'If-None-Match header contains "*" mixed with other values, which is syntactically invalid.',
        };
      }

      return false;
    }),
  )
  .done();
