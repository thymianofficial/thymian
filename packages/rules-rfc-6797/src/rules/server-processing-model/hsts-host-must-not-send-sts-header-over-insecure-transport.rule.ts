import {
  type ApiContext,
  httpRule,
  protocol,
  type RuleFn,
} from '@thymian/core';

import {
  carriesHeader,
  isServerFallbackOrigin,
  serverFallbackSkip,
  violation,
} from '../utils/sts-contexts.js';
import { STS_HEADER } from '../utils/sts-field-value.js';

const NAME =
  'rfc-6797/hsts-host-must-not-send-sts-header-over-insecure-transport';

const MESSAGE =
  'This response over non-secure transport (http) carries a Strict-Transport-Security header field. An HSTS Host MUST NOT include it in responses conveyed over non-secure transport.';

// Sending the header at all is what makes a host an HSTS Host (§5.1), so the
// condition in "An HSTS Host MUST NOT" is met by the very header this rule
// looks for: exact in every context, never heuristic. The common interface
// sees both facts — the scheme through its request filter, the header by
// name — so one function serves every context; only whether the server URL
// fallback is skipped differs. It is skipped only where a header is there to
// be judged: without one, the response conforms whatever the scheme.
function judgeTransport({
  skipServerFallback,
}: {
  skipServerFallback: boolean;
}): RuleFn<ApiContext, Record<PropertyKey, unknown>> {
  return (ctx) =>
    ctx.validateCommonHttpTransactions(
      protocol('http'),
      (req, res, location) => {
        if (!carriesHeader(res, STS_HEADER)) {
          return [];
        }
        return skipServerFallback && isServerFallbackOrigin(req.origin)
          ? [serverFallbackSkip(location, NAME)]
          : [violation(location, MESSAGE)];
      },
    );
}

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.2')
  .description(
    'An HSTS Host MUST NOT include the STS header field in HTTP responses conveyed over non-secure transport.',
  )
  .summary('HSTS Host must not send Strict-Transport-Security over plain HTTP.')
  .explanation(
    'Over plain HTTP an attacker on the network can add, remove or rewrite any header, so a Strict-Transport-Security header received that way proves nothing about the host — which is why user agents must ignore it (RFC 6797 §8.1). Sending it anyway protects nobody, and it signals a deployment that does not distinguish its secure and insecure listeners: the same configuration that sends the header over http is often the one that serves real content there instead of redirecting to https.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the
  // fallback; recorded traffic in `analytics` is real, so it never does.
  .rule(judgeTransport({ skipServerFallback: true }))
  .overrideAnalyticsRule(judgeTransport({ skipServerFallback: false }))
  .done();
