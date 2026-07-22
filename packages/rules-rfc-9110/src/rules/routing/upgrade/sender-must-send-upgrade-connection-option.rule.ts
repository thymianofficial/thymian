import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-must-send-upgrade-connection-option')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A sender of Upgrade MUST also send an "Upgrade" connection option in the Connection header field to inform intermediaries not to forward this field. This ensures the Upgrade header is treated as a hop-by-hop header.',
  )
  .summary('Sender MUST include "Upgrade" in Connection header.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('upgrade'),
      (req, _res, location) => {
        const connectionHeader = getHeader(req.headers, 'connection');

        const connectionHeaderValues =
          connectionHeader === undefined
            ? []
            : Array.isArray(connectionHeader)
              ? connectionHeader
              : [connectionHeader];

        // Connection may carry a comma-separated list of options; "Upgrade"
        // must appear as one of them (case-insensitive).
        const listsUpgrade = connectionHeaderValues
          .flatMap((value) => value.split(','))
          .some((option) => option.trim().toLowerCase() === 'upgrade');

        return listsUpgrade ? [] : [{ location, violation: {}, findings: [] }];
      },
    ),
  )
  .done();
