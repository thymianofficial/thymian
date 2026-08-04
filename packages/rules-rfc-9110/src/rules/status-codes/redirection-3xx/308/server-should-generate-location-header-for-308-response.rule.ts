import {
  getHeader,
  type HttpResponse,
  not,
  responseHeader,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { hasNonEmptyHeaderValue } from '../../utils/headers.js';

export default httpRule(
  'rfc9110/server-should-generate-location-header-for-308-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-308-permanent-redirect',
  )
  .description(
    'The server SHOULD generate a Location header field in the response containing a preferred URI reference for the new permanent URI.',
  )
  .explanation(
    'When you return a 308 (Permanent Redirect), include a Location header field whose value is the new permanent URI for the resource. This matters because 308 tells clients the resource has moved for good, and the user agent uses the Location value to follow the redirect and, where supported, to update stored links to point at the new address. Without a usable Location the client cannot reach the resource and cannot learn the correct permanent URI, so ensure the header is present and holds a real URI reference rather than an empty value.',
  )
  .appliesTo('server')
  // Static floor asserts the Location header name is present. The real-data
  // overrides additionally read the VALUE to catch an empty "Location:" that
  // satisfies presence but carries no URI reference.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(308),
      not(responseHeader('location')),
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(308),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 308 (Permanent Redirect) response is missing a non-empty Location header field.',
                },
                findings: [],
              },
            ],
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(308),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 308 (Permanent Redirect) response is missing a non-empty Location header field.',
                },
                findings: [],
              },
            ],
    ),
  )
  .done();
