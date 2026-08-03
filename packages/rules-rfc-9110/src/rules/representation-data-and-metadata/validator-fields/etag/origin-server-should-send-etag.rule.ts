import { and, not, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-should-send-etag')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.1')
  .description(
    `An origin server SHOULD send an ETag for any selected representation for which detection of changes can be
    reasonably and consistently determined, since the entity tag's use in conditional requests and evaluating cache
    freshness can substantially reduce unnecessary transfers and significantly improve service availability, scalability, and reliability.`,
  )
  .summary(
    'Origin servers SHOULD send ETag header when change detection can be determined.',
  )
  .explanation(
    'Whenever your server can reasonably tell when a resource has changed, it should attach an ETag validator to the response. Clients and caches use that tag in conditional requests to ask "has this changed since the version I hold?", letting the server answer with a small 304 Not Modified instead of resending the whole body. Providing ETags cuts redundant transfers and improves availability, scalability, and reliability under load.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        // Only for successful responses
        statusCodeRange(200, 299),
        // Should have at least one validator
        not(responseHeader('etag')),
      ),
    ),
  )
  .done();
