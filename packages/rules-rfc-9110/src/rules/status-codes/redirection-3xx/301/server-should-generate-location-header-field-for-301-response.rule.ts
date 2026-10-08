import {
  getHeader,
  type HttpResponse,
  type HttpRuleCriteria,
  not,
  responseHeader,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { hasNonEmptyHeaderValue } from '../../utils/headers.js';

// The real-data contexts (test and analyze) share one set of criteria.
const liveCriteria: HttpRuleCriteria = {
  appliesTo: statusCode(301),
  violatedWhen: (_req, res: HttpResponse, location: RuleViolationLocation) =>
    hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
      ? []
      : [
          {
            location,
            violation: {},
            findings: [],
          },
        ],
};

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-should-generate-location-header-field-for-301-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently')
  .description(
    'The server SHOULD generate a Location header field in the response containing a preferred URI reference for the new permanent URI.',
  )
  .explanation(
    'When a server returns 301 to say a resource has permanently moved, it should include a Location header giving the new permanent URI where the resource now lives. This matters because 301 signals a permanent move; the Location value is what lets clients automatically follow the redirect and update stored links to the new address, so omitting it tells the client the resource moved but never says where.',
  )
  .appliesTo('server')
  // Static floor asserts the Location header name is present. The real-data
  // overrides additionally read the VALUE to catch an empty "Location:" that
  // satisfies presence but carries no URI reference.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCode(301),
      violatedWhen: not(responseHeader('location')),
    }),
  )
  .overrideTest((ctx) => ctx.validateHttpTransactions(liveCriteria))
  .overrideAnalyticsRule((ctx) => ctx.validateHttpTransactions(liveCriteria))
  .done();
