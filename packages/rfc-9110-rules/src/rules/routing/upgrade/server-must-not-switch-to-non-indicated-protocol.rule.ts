import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-switch-to-non-indicated-protocol',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    "A server MUST NOT switch to a protocol that was not indicated by the client in the corresponding request's Upgrade header field. The server can only switch to protocols explicitly requested by the client.",
  )
  .summary('Server MUST NOT switch to protocol not indicated by client.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('upgrade'), (req, res) => {
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

        return resUpgradeProtocols.some(
          (protocol) => !reqUpgradeProtocols.includes(protocol),
        );
      }

      return false;
    }),
  )
  .done();
