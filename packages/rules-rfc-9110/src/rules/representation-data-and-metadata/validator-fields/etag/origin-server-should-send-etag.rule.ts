import { and, not, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-should-send-etag')
  .severity('warn')
  // Implementable now (outcome 1): a response-side presence check needing only
  // the ETag header NAME and status code, so the common projection serves
  // static/test/analyze via one shared `.rule()`. `appliesTo('origin server')`
  // matches the default HAR response role so the analyze rule fires on recorded
  // traffic. The SHOULD is conditional ("for which detection of changes can be
  // reasonably and consistently determined"); that condition is server-internal
  // and unobservable, so this is intentionally a `warn`-level heuristic flagging
  // missing ETags on successful responses.
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
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        // Only for successful responses
        statusCodeRange(200, 299),
        // Should have at least one validator
        not(responseHeader('etag')),
      ),
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'The successful response does not include an ETag header field. An origin server SHOULD send an ETag for any representation whose changes can be reasonably and consistently determined, to enable conditional requests and cache validation.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
