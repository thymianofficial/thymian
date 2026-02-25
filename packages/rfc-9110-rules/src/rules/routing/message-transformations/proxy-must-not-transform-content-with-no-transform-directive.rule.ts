import { getHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-must-not-transform-content-with-no-transform-directive',
)
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MUST NOT transform the content of a response message that contains a no-transform cache directive. Note that this does not apply to message transformations that do not change the content, such as the addition or removal of transfer codings.',
  )
  .summary(
    'Proxy MUST NOT transform content when no-transform directive is present.',
  )
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
          cacheControlHeader.includes('no-transform') &&
          prev.request.data !== curr.request.data
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
