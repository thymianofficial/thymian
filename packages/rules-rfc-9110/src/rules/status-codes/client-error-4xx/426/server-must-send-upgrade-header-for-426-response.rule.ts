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
  'rfc9110/server-must-send-upgrade-header-for-426-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-426-upgrade-required')
  .description(
    'The server MUST send an Upgrade header field in a 426 response to indicate the required protocol(s).',
  )
  .explanation(
    'When a server returns 426 to say it will only handle the request over a different protocol, it must include an Upgrade header naming which protocol(s) the client should switch to (for example, Upgrade: HTTP/3.0). This matters because 426 is an invitation to upgrade rather than a plain refusal; without the Upgrade header the client is told to change protocols but never told which one, so it cannot act and the exchange is stuck.',
  )
  .appliesTo('server')
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
                violation: {},
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
                violation: {},
                findings: [],
              },
            ],
    ),
  )
  .done();
