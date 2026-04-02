import { and, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-when-if-none-match-present',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore If-Modified-Since if the request contains an If-None-Match header field; the condition in If-None-Match is considered to be a more accurate replacement for the condition in If-Modified-Since, and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-None-Match.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since when If-None-Match is present.',
  )
  .tags('conditional-requests', 'if-modified-since', 'if-none-match')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('if-none-match'), requestHeader('if-modified-since')),
    ),
  )
  .done();
