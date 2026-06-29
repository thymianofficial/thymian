import {
  and,
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/robotic-user-agent-should-send-valid-from-header',
)
  .severity('warn')
  // Request-side, analytics-only (#327). The previous `static` slot validated
  // nothing meaningful: the common (lint) projection exposes header *names*
  // only, so the From value cannot be validated at design time, and whether a
  // user agent is "robotic" cannot be inferred from a spec. `test` is
  // inapplicable (Thymian generates the request, so it cannot exercise an
  // invalid From). The honest, observable subset is: on recorded client
  // traffic, a present From header should carry a valid mailbox.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-from')
  .description(
    'A robotic user agent SHOULD send a valid From header field so that the person responsible for running the robot can be contacted if problems occur on servers.',
  )
  .summary(
    'A From header field sent by a (robotic) user agent SHOULD contain a valid mailbox.',
  )
  // Request-side: HAR requests default to the `user-agent` role.
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('from')),
      (request, _res, location: RuleViolationLocation) => {
        const from = getHeader(request.headers, 'from');

        if (typeof from !== 'string') {
          return [];
        }

        // when ABNF support is added, we should replace this regex with the ABNF defined in RFC 5322
        // Basic email validation
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return !emailRegex.test(from.trim())
          ? [
              {
                location,
                violation: {
                  message: `The From header field value "${from.trim()}" is not a valid mailbox. A (robotic) user agent SHOULD send a valid From header so the operator can be contacted.`,
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
