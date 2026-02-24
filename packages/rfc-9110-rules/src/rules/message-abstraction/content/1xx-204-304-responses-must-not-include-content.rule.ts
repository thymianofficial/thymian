import {
  and,
  hasResponseBody,
  or,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/1xx-204-304-responses-must-not-include-content',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1')
  .description(
    'All 1xx (Informational), 204 (No Content), and 304 (Not Modified) responses do not include content.',
  )
  .summary('1xx, 204, and 304 responses MUST NOT include content.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        or(statusCodeRange(100, 199), statusCode(204), statusCode(304)),
        hasResponseBody(),
      ),
    ),
  )
  .done();
