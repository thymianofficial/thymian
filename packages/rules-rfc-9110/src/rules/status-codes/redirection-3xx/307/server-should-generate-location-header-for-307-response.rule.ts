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
  'rfc9110/server-should-generate-location-header-for-307-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-307-temporary-redirect',
  )
  .description(
    'The server SHOULD generate a Location header field in the response containing a URI reference for the different URI.',
  )
  .explanation(
    'When you return a 307 (Temporary Redirect), include a Location header field whose value is the URI the client should use for this request right now. This matters because 307 tells the client the resource is temporarily somewhere else, and the user agent relies on the Location value to follow the redirect automatically. Without a usable Location, the client has no target to go to and the redirect fails, so make sure the header is present and carries a real URI reference, not an empty value.',
  )
  .appliesTo('server')
  // Static floor asserts the Location header name is present. The real-data
  // overrides additionally read the VALUE to catch an empty "Location:" that
  // satisfies presence but carries no URI reference.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(307),
      not(responseHeader('location')),
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(307),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 307 (Temporary Redirect) response is missing a non-empty Location header field.',
                },
                findings: [],
              },
            ],
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(307),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'location'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 307 (Temporary Redirect) response is missing a non-empty Location header field.',
                },
                findings: [],
              },
            ],
    ),
  )
  .done();
