import { httpRule, type LiveApiContext, protocol } from '@thymian/core';

import {
  declaresStsHeader,
  describedTransaction,
  isFabricatedServerFallback,
  liveStsValues,
  violation,
} from '../utils/sts-contexts.js';

const MESSAGE =
  'This response over non-secure transport (http) carries a Strict-Transport-Security header field. An HSTS Host MUST NOT include it in responses conveyed over non-secure transport.';

// Sending the header at all is what makes a host an HSTS Host (§5.1), so the
// condition in "An HSTS Host MUST NOT" is met by the very header this rule
// looks for: the assertion is exact in every context, never heuristic.
function checkLive(
  ctx: LiveApiContext,
  { skipServerFallback }: { skipServerFallback: boolean },
) {
  return ctx.validateHttpTransactions(
    protocol('http'),
    (_req, res, location) => {
      const described = describedTransaction(ctx, location)?.thymianReq;
      if (
        skipServerFallback &&
        described !== undefined &&
        isFabricatedServerFallback(described)
      ) {
        return [];
      }
      return liveStsValues(res.headers).length > 0
        ? [violation(location, MESSAGE)]
        : [];
    },
  );
}

export default httpRule(
  'rfc-6797/hsts-host-must-not-send-sts-header-over-insecure-transport',
)
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
  // Static: the scheme is the declared server's. A document whose server URL
  // could not be resolved is loaded as http://localhost:8080
  // (thymianofficial/thymian-workspace#81), so that
  // fallback is skipped rather than reported as a transport it never declared.
  .overrideStaticRule((ctx) =>
    ctx.validateHttpTransactions(
      (req, res) =>
        req.protocol === 'http' &&
        !isFabricatedServerFallback(req) &&
        declaresStsHeader(res),
      () => ({ violation: { message: MESSAGE }, findings: [] }),
    ),
  )
  // Test: the request goes to the described server, so the same fallback
  // carries over — a document with no usable server run against a target URL
  // still records http://localhost:8080 as the request's origin.
  .overrideTest((ctx) => checkLive(ctx, { skipServerFallback: true }))
  .overrideAnalyticsRule((ctx) => checkLive(ctx, { skipServerFallback: false }))
  .done();
