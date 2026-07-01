import {
  and,
  getHeader,
  hasRequestBody,
  not,
  requestHeader,
  type HttpResponse,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-generate-100-continue-without-content',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client MUST NOT generate a 100-continue expectation in a request that does not include content.',
  )
  .appliesTo('client', 'user-agent')
  // Static context sees only header NAMES / body presence, so it can only
  // coarsely prefilter to requests that carry Expect without content. It
  // cannot tell whether the Expect VALUE is exactly "100-continue"; that
  // value check is only possible against real recorded traffic in analytics.
  .overrideStaticRule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('expect'), not(hasRequestBody())),
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('expect'), not(hasRequestBody())),
      (request, _res: HttpResponse, location: RuleViolationLocation) => {
        const expect = getHeader(request.headers, 'expect');
        const values = (
          Array.isArray(expect) ? expect : expect != null ? [expect] : []
        )
          .flatMap((s) => s.split(','))
          .map((s) => s.trim().toLowerCase());

        return values.includes('100-continue')
          ? [
              {
                location,
                violation: {
                  message:
                    'A client MUST NOT generate a 100-continue expectation in a request that does not include content, but this request sends "Expect: 100-continue" with no content.',
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
