import { and, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-when-if-match-present',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore If-Unmodified-Since if the request contains an If-Match header field; the condition in If-Match is considered to be a more accurate replacement for the condition in If-Unmodified-Since, and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-Match.',
  )
  .summary(
    'Recipient MUST ignore If-Unmodified-Since when If-Match is present.',
  )
  .appliesTo('server', 'cache')
  .tags('conditional-requests', 'if-unmodified-since', 'if-match')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('if-match'), requestHeader('if-unmodified-since')),
    ),
  )
  .done();
