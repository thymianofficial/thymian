import {
  and,
  getHeader,
  type HttpResponse,
  not,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-send-te-connection-option-with-te-header',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-te')
  .description(
    'A sender of TE MUST also send a "TE" connection option within the Connection header field to inform intermediaries not to forward this field.',
  )
  // Static context sees only header NAMES, so it can only assert structurally
  // that a request carrying TE also carries a Connection header. The RFC
  // requirement is on the Connection VALUE (it must list the "te" option),
  // which is only checkable against real recorded traffic in analytics below.
  .overrideStaticRule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('te'), not(requestHeader('connection'))),
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('te'),
      (request, _res: HttpResponse, location: RuleViolationLocation) => {
        const connection = getHeader(request.headers, 'connection');
        const tokens = (
          Array.isArray(connection)
            ? connection
            : connection != null
              ? [connection]
              : []
        )
          .flatMap((s) => s.split(','))
          .map((s) => s.trim().toLowerCase());

        return tokens.includes('te')
          ? []
          : [
              {
                location,
                violation: {
                  message:
                    'The request sends a TE header field, but the Connection header field does not list the "te" connection option.',
                },
                findings: [],
              },
            ];
      },
    ),
  )
  .done();
