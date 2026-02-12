import { and, not, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-server-should-send-last-modified')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.1')
  .description(
    `An origin server SHOULD send Last-Modified for any selected representation for which a last modification date
    can be reasonably and consistently determined, since its use in conditional requests and evaluating cache freshness
    can substantially reduce unnecessary transfers and significantly improve service availability and scalability.`,
  )
  .summary(
    'Origin servers SHOULD send Last-Modified header when modification date can be determined.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        // Only for successful responses
        statusCodeRange(200, 299),
        // Should have at least one validator
        not(responseHeader('last-modified')),
      ),
    ),
  )
  .done();
