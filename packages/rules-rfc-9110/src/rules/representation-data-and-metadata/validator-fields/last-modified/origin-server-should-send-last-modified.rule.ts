import { and, not, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-should-send-last-modified')
  .severity('warn')
  // Implementable now (outcome 1): a response-side presence check needing only
  // the Last-Modified header NAME and status code, so the common projection
  // serves static/test/analyze via one shared `.rule()`.
  // `appliesTo('origin server')` matches the default HAR response role. As with
  // ETag, the SHOULD is conditional on a determinable modification date
  // (server-internal, unobservable), so this is a `warn`-level heuristic.
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
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'The successful response does not include a Last-Modified header field. An origin server SHOULD send Last-Modified for any representation whose modification date can be reasonably and consistently determined, to enable conditional requests and cache freshness evaluation.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
