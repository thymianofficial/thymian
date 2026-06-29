import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../utils.js';

export default httpRule(
  'rfc9110/server-must-not-switch-to-non-indicated-protocol',
)
  .severity('error')
  // Response-side server-behaviour rule. Comparing the response's Upgrade
  // protocol(s) against the request's requires header VALUES, so it uses
  // validateHttpTransactions on a LiveApiContext. Meaningful in both test
  // (Thymian observes the live response to a request it sent) and analyze
  // (recorded traffic). Scoped to 'origin server' so it also fires on HAR
  // responses.
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    "A server MUST NOT switch to a protocol that was not indicated by the client in the corresponding request's Upgrade header field. The server can only switch to protocols explicitly requested by the client.",
  )
  .summary('Server MUST NOT switch to protocol not indicated by client.')
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('upgrade'),
      (req, res, location) => {
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
