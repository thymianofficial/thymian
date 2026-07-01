import {
  getHeader,
  not,
  responseHeader,
  statusCode,
  type HttpResponse,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

function hasNonEmptyHeaderValue(value: string | string[] | undefined): boolean {
  const list = Array.isArray(value) ? value : value != null ? [value] : [];
  return list.some((v) => v.trim().length > 0);
}

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
  .appliesTo('server', 'origin server')
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
                    'A 308 (Permanent Redirect) response is missing a non-empty Location header field. The server SHOULD generate a Location header field containing a preferred URI reference for the new permanent URI.',
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
                    'A 308 (Permanent Redirect) response is missing a non-empty Location header field. The server SHOULD generate a Location header field containing a preferred URI reference for the new permanent URI.',
                },
                findings: [],
              },
            ],
    ),
  )
  .done();
