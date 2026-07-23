import {
  and,
  getHeader,
  hasRequestBody,
  not,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-generate-100-continue-without-content',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client MUST NOT generate a 100-continue expectation in a request that does not include content.',
  )
  .appliesTo('client')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('expect'), not(hasRequestBody())),
      (request, _res, location: RuleViolationLocation) => {
        const expect = getHeader(request.headers, 'expect');
        // Expectation names are compared case-insensitively and the Expect
        // field is a comma-separated list, so the value cannot be matched
        // with an exact-value filter.
        const expectations = (
          Array.isArray(expect) ? expect : expect != null ? [expect] : []
        )
          .flatMap((value) => value.split(','))
          .map((value) => value.trim().toLowerCase());

        return expectations.includes('100-continue')
          ? [
              {
                location,
                violation: {
                  message:
                    'The request generates a 100-continue expectation but does not include content.',
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
