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
  'rfc9110/server-must-send-upgrade-header-for-426-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-426-upgrade-required')
  .description(
    'The server MUST send an Upgrade header field in a 426 response to indicate the required protocol(s).',
  )
  .appliesTo('server', 'origin server')
  // Static floor: the spec exposes only header NAMES, so we assert Upgrade is
  // declared. The real-data overrides additionally read the VALUE to catch an
  // empty "Upgrade:" that satisfies presence but names no protocol.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(426),
      not(responseHeader('upgrade')),
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(426),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'upgrade'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 426 (Upgrade Required) response is missing a non-empty Upgrade header field. The server MUST send an Upgrade header field indicating the required protocol(s).',
                },
                findings: [],
              },
            ],
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(426),
      (_req, res: HttpResponse, location: RuleViolationLocation) =>
        hasNonEmptyHeaderValue(getHeader(res.headers, 'upgrade'))
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A 426 (Upgrade Required) response is missing a non-empty Upgrade header field. The server MUST send an Upgrade header field indicating the required protocol(s).',
                },
                findings: [],
              },
            ],
    ),
  )
  .done();
