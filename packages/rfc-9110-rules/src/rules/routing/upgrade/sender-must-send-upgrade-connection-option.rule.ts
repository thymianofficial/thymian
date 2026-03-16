import { and, getHeader, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/sender-must-send-upgrade-connection-option')
  .severity('error')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A sender of Upgrade MUST also send an "Upgrade" connection option in the Connection header field to inform intermediaries not to forward this field. This ensures the Upgrade header is treated as a hop-by-hop header.',
  )
  .summary('Sender MUST include "Upgrade" in Connection header.')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('upgrade'), (req) => {
      const connectionHeader = getHeader(req.headers, 'connection');

      if (!connectionHeader) {
        return true;
      }

      const connectionHeaderValues = Array.isArray(connectionHeader)
        ? connectionHeader
        : [connectionHeader];

      return !connectionHeaderValues.find(
        (value) => value.toLowerCase().trim() === 'upgrade',
      );
    }),
  )
  .done();
