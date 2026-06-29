import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-must-send-upgrade-connection-option')
  .severity('error')
  // Request-side rule: it constrains how the *sender* of an Upgrade request
  // populates the Connection header. The previous typing included `static`
  // without a static rule function (an undeclared-context gap) and a `test`
  // slot would be meaningless because Thymian generates the request, so the
  // sender's Connection header is not under user control. It is therefore only
  // validated against recorded traffic (`analyze`), where the request comes
  // from a real client, reading the Connection header VALUES via
  // validateHttpTransactions on the AnalyzeContext. Scoped to the request
  // (client/user-agent) roles so it fires on HAR requests.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A sender of Upgrade MUST also send an "Upgrade" connection option in the Connection header field to inform intermediaries not to forward this field. This ensures the Upgrade header is treated as a hop-by-hop header.',
  )
  .summary('Sender MUST include "Upgrade" in Connection header.')
  .appliesTo('client', 'user-agent')
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

        return listsUpgrade
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'A request carried an Upgrade header but the Connection header did not list the "Upgrade" connection option. A sender of Upgrade MUST also send an "Upgrade" connection option so intermediaries treat the field as hop-by-hop.',
                },
                findings: [],
              },
            ];
      },
    ),
  )
  .done();
