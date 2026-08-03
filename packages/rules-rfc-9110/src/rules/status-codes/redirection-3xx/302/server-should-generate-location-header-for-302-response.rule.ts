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
  .explanation(
    'When a server returns 302 to say a resource is temporarily at a different URI, it should include a Location header giving that temporary URI. This matters because the Location value is what lets a client automatically follow the redirect to the current location; because the move is only temporary the client keeps using the original URI for future requests, but for this response it needs the Location to know where to go now.',
  )
  .appliesTo('server')
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
                violation: {},
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
                violation: {},
                findings: [],
              },
            ],
    ),
  )
  .done();
