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
  'rfc9110/server-should-generate-location-header-for-302-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-302-found')
  .description(
    'The server SHOULD generate a Location header field in the response containing a URI reference for the different URI.',
  )
  .appliesTo('server', 'origin server')
  // Static floor asserts the Location header name is present. The real-data
  // overrides additionally read the VALUE to catch an empty "Location:" that
  // satisfies presence but carries no URI reference.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(302),
      not(responseHeader('location')),
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(302),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 302 (Found) response is missing a non-empty Location header field. The server SHOULD generate a Location header field containing a URI reference for the different URI.',
                },
                findings: [],
              },
            ],
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(302),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 302 (Found) response is missing a non-empty Location header field. The server SHOULD generate a Location header field containing a URI reference for the different URI.',
                },
                findings: [],
              },
            ],
    ),
  )
  .done();
