import { getHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-may-transform-content-without-no-transform-directive',
)
  .severity('hint')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MAY transform the content of a message that does not contain a no-transform cache directive. A proxy that transforms the content of a 200 (OK) response can inform downstream recipients that a transformation has been applied by changing the response status code to 203 (Non-Authoritative Information).',
  )
  .summary('Proxy MAY transform content without no-transform directive.')
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      for (let i = 1; i < trace.length; i++) {
        const prev = trace[i - 1];
        const curr = trace[i];

        if (!prev || !curr) {
          continue;
        }

        const cacheControlHeader = getHeader(
          prev.request.data.headers,
          'cache-control',
        );

        if (
          cacheControlHeader &&
          !cacheControlHeader.includes('no-transform') &&
          prev.request.data === curr.request.data
        ) {
          ctx.reportViolation({
            location,
          });
        }
      }

      return false;
    }),
  )
  .done();
