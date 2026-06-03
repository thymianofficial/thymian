import {
  and,
  getHeader,
  type HttpResponse,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/robotic-user-agent-should-send-valid-from-header',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-from')
  .description(
    'A robotic user agent SHOULD send a valid From header field so that the person responsible for running the robot can be contacted if problems occur on servers.',
  )
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(requestHeader('from'))))
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('from')),
      (request, _res: HttpResponse, location: RuleViolationLocation) => {
        const from = getHeader(request.headers, 'from');

        if (typeof from !== 'string') {
          return [];
        }

        // when ABNF support is added, we should replace this regex with the ABNF defined in RFC 5322
        // Basic email validation
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return !emailRegex.test(from)
          ? [{ location, violation: {}, findings: [] }]
          : [];
      },
    ),
  )
  .done();
