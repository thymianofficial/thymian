import type { HttpResponse, RuleViolationLocation } from '@thymian/core';
import { and, getHeader, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../utils.js';

function upgradeProtocols(header: string | string[]): string[] {
  const values = Array.isArray(header) ? header : [header];
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(','))
        .map((protocol) => protocol.trim().toLowerCase())
        .filter((protocol) => protocol.length > 0),
    ),
  ];
}

export default httpRule(
  'rfc9110/server-must-not-switch-to-non-indicated-protocol',
)
  .severity('error')
  // Compares the protocols the CLIENT indicated in its request Upgrade header
  // against those the server echoes in the response. Both sides are only present in
  // recorded real-client traffic, which is why this runs as an analytics override.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    "A server MUST NOT switch to a protocol that was not indicated by the client in the corresponding request's Upgrade header field. The server can only switch to protocols explicitly requested by the client.",
  )
  .summary('Server MUST NOT switch to protocol not indicated by client.')
  .appliesTo('server')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      // A protocol switch is only signaled by a 101 (Switching Protocols)
      // response; Upgrade headers in other responses merely advertise support.
      and(requestHeader('upgrade'), statusCode(101)),
      (req, res: HttpResponse, location: RuleViolationLocation) => {
        const reqUpgradeHeader = getHeader(req.headers, 'upgrade');
        const resUpgradeHeader = getHeader(res.headers, 'upgrade');

        if (reqUpgradeHeader && resUpgradeHeader) {
          const reqUpgradeProtocols = upgradeProtocols(reqUpgradeHeader);
          const resUpgradeProtocols = upgradeProtocols(resUpgradeHeader);

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
                    )} that the client did not indicate in its request Upgrade header.`,
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
