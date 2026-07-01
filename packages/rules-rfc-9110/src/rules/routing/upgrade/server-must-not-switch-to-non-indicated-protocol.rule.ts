import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';
import type { HttpResponse, RuleViolationLocation } from '@thymian/core';

import { createList } from '../../../utils.js';

export default httpRule(
  'rfc9110/server-must-not-switch-to-non-indicated-protocol',
)
  .severity('error')
  // Request<->response correlation on the Upgrade header: the check compares the
  // protocols the CLIENT indicated in its request Upgrade header against those the
  // server echoes in the response. In 'test' the request is Thymian-generated and
  // carries no client Upgrade header, so the filter is inert there. Only recorded
  // real-client traffic ('analytics') carries both sides, so this runs analytics-only.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    "A server MUST NOT switch to a protocol that was not indicated by the client in the corresponding request's Upgrade header field. The server can only switch to protocols explicitly requested by the client.",
  )
  .summary('Server MUST NOT switch to protocol not indicated by client.')
  .appliesTo('server', 'origin server')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('upgrade'),
      (req, res: HttpResponse, location: RuleViolationLocation) => {
        const reqUpgradeHeader = getHeader(req.headers, 'upgrade');
        const resUpgradeHeader = getHeader(res.headers, 'upgrade');

        if (reqUpgradeHeader && resUpgradeHeader) {
          const reqUpgradeHeaderArray = Array.isArray(reqUpgradeHeader)
            ? reqUpgradeHeader
            : [reqUpgradeHeader];
          const resUpgradeHeaderArray = Array.isArray(resUpgradeHeader)
            ? resUpgradeHeader
            : [resUpgradeHeader];

          const reqUpgradeProtocols = reqUpgradeHeaderArray
            .join(', ')
            .split(',')
            .map((protocol) => protocol.trim().toLowerCase());
          const resUpgradeProtocols = resUpgradeHeaderArray
            .join(', ')
            .split(',')
            .map((protocol) => protocol.trim().toLowerCase());

          const switchedToUnrequested = resUpgradeProtocols.filter(
            (protocol) => !reqUpgradeProtocols.includes(protocol),
          );
          return switchedToUnrequested.length > 0
            ? [
                {
                  location,
                  violation: {
                    message: `The response's Upgrade header lists protocol(s) ${createList(
                      switchedToUnrequested,
                    )} that the client did not indicate in its request Upgrade header. A server MUST NOT switch to a protocol the client did not request.`,
                  },
                  findings: [],
                },
              ]
            : [];
        }

        return [];
      },
    ),
  )
  .done();
