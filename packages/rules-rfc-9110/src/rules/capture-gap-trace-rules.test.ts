import type {
  CapturedTrace,
  CapturedTransaction,
  CaptureGap,
  HttpParticipantRole,
  Rule,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { runAnalyticsRule } from '../../test/run-analytics-rule.js';
import proxyMustNotModifyAuthenticationInfo from './authentication/origin-server/authentication-info/proxy-must-not-modify-authentication-info.rule.js';
import proxyMustNotModifyAuthorization from './authentication/origin-server/authorization/proxy-must-not-modify-authorization.rule.js';
import proxyMustNotModifyWwwAuthenticate from './authentication/origin-server/www-authenticate/proxy-must-not-modify-www-authenticate.rule.js';
import proxyMustForwardUnrecognizedHeaderFields from './fields/field-names/proxy-must-forward-unrecognized-header-fields.rule.js';
import proxyMustNotGenerateNewMaxForwardsHeader from './methods/method-definitions/options/proxy-must-not-generate-new-max-forwards-header.rule.js';
import intermediaryMustGenerateUpdatedMaxForwardsWhenForwarding from './routing/message-forwarding/max-forwards/intermediary-must-generate-updated-max-forwards-when-forwarding.rule.js';
import proxyMayTransformContentWithoutNoTransformDirective from './routing/message-transformations/proxy-may-transform-content-without-no-transform-directive.rule.js';
import proxyShouldNotModifyEndpointAndRepresentationHeaders from './routing/message-transformations/proxy-should-not-modify-endpoint-and-representation-headers.rule.js';

type Headers = Record<string, string>;
type Pair = [proxyHop: Headers, nextHop: Headers];

/**
 * A trace rule that compares a header field across a forwarding proxy, with
 * the message side it compares and three header pairs for that side: one the
 * rule reports, one it accepts, and one it reports where a hop was recorded
 * with no headers.
 */
type GuardedRule = {
  rule: Rule;
  side: 'request' | 'response';
  method?: string;
  violating: Pair;
  compliant: Pair;
  recordedEmpty: Pair;
};

const NOT_CAPTURED: CaptureGap[] = [{ kind: 'headers-not-captured' }];

const guardedRules: GuardedRule[] = [
  {
    rule: proxyMustNotModifyAuthorization,
    side: 'request',
    violating: [{ authorization: 'Bearer a' }, { authorization: 'Bearer b' }],
    compliant: [{ authorization: 'Bearer a' }, { authorization: 'Bearer a' }],
    recordedEmpty: [{ authorization: 'Bearer a' }, {}],
  },
  {
    rule: proxyMustNotModifyWwwAuthenticate,
    side: 'response',
    violating: [
      { 'www-authenticate': 'Basic realm="a"' },
      { 'www-authenticate': 'Basic realm="b"' },
    ],
    compliant: [
      { 'www-authenticate': 'Basic realm="a"' },
      { 'www-authenticate': 'Basic realm="a"' },
    ],
    recordedEmpty: [{}, { 'www-authenticate': 'Basic realm="a"' }],
  },
  {
    rule: proxyMustNotModifyAuthenticationInfo,
    side: 'response',
    violating: [
      { 'authentication-info': 'rspauth="a"' },
      { 'authentication-info': 'rspauth="b"' },
    ],
    compliant: [
      { 'authentication-info': 'rspauth="a"' },
      { 'authentication-info': 'rspauth="a"' },
    ],
    recordedEmpty: [{}, { 'authentication-info': 'rspauth="a"' }],
  },
  {
    rule: proxyShouldNotModifyEndpointAndRepresentationHeaders,
    side: 'response',
    violating: [
      { 'content-type': 'text/html' },
      { 'content-type': 'application/json' },
    ],
    compliant: [
      { 'content-type': 'text/html' },
      { 'content-type': 'text/html' },
    ],
    recordedEmpty: [{}, { 'content-type': 'text/html' }],
  },
  {
    rule: intermediaryMustGenerateUpdatedMaxForwardsWhenForwarding,
    side: 'request',
    method: 'trace',
    violating: [{ 'max-forwards': '5' }, { 'max-forwards': '5' }],
    compliant: [{ 'max-forwards': '5' }, { 'max-forwards': '4' }],
    recordedEmpty: [{ 'max-forwards': '5' }, {}],
  },
  {
    rule: proxyMustNotGenerateNewMaxForwardsHeader,
    side: 'request',
    method: 'options',
    violating: [{ accept: '*/*' }, { accept: '*/*', 'max-forwards': '3' }],
    compliant: [{ 'max-forwards': '3' }, { 'max-forwards': '2' }],
    recordedEmpty: [{}, { 'max-forwards': '3' }],
  },
  {
    rule: proxyMustForwardUnrecognizedHeaderFields,
    side: 'request',
    violating: [{ 'x-custom': 'v', accept: '*/*' }, { accept: '*/*' }],
    compliant: [{ 'x-custom': 'v' }, { 'x-custom': 'v' }],
    recordedEmpty: [{ 'x-custom': 'v' }, {}],
  },
];

/**
 * One recorded hop from `from` to `to`: the request carries role `from`, the
 * response role `to`, as in recorded traffic. `headers` and `gaps` go on the
 * message side the rule compares.
 */
function hop(
  from: HttpParticipantRole,
  to: HttpParticipantRole,
  {
    side,
    method = 'get',
    body,
  }: { side: 'request' | 'response'; method?: string; body?: string },
  headers: Headers,
  gaps?: CaptureGap[],
): CapturedTransaction {
  const gapMeta = gaps && { captureGaps: gaps };
  return {
    request: {
      data: {
        origin: 'https://example.com',
        path: '/',
        method,
        headers: side === 'request' ? headers : {},
      },
      meta: { role: from, ...(side === 'request' && gapMeta) },
    },
    response: {
      data: {
        statusCode: 200,
        headers: side === 'response' ? headers : {},
        body,
        trailers: {},
        duration: 1,
      },
      meta: { role: to, ...(side === 'response' && gapMeta) },
    },
  };
}

/** A trace through one proxy: user agent to proxy, then proxy to origin. */
function trace(
  guarded: GuardedRule,
  [proxyHop, nextHop]: Pair,
  marked?: 'proxy hop' | 'next hop',
): CapturedTrace {
  return [
    hop(
      'user-agent',
      'proxy',
      guarded,
      proxyHop,
      marked === 'proxy hop' ? NOT_CAPTURED : undefined,
    ),
    hop(
      'proxy',
      'origin server',
      guarded,
      nextHop,
      marked === 'next hop' ? NOT_CAPTURED : undefined,
    ),
  ];
}

const violations = async (rule: Rule, captured: CapturedTrace) =>
  (await runAnalyticsRule(rule, [], [captured])).filter((r) => r.violation);

describe.each(guardedRules.map((g) => [g.rule.meta.name, g] as const))(
  '%s on a trace through the analyzer',
  (_, guarded) => {
    it('reports a field the proxy changed', async () => {
      expect(
        await violations(guarded.rule, trace(guarded, guarded.violating)),
      ).toHaveLength(1);
    });

    it('accepts a compliant hop', async () => {
      expect(
        await violations(guarded.rule, trace(guarded, guarded.compliant)),
      ).toHaveLength(0);
    });

    it('reports where a hop was recorded with no headers', async () => {
      expect(
        await violations(guarded.rule, trace(guarded, guarded.recordedEmpty)),
      ).toHaveLength(1);
    });

    it.each(['proxy hop', 'next hop'] as const)(
      'stays silent when the %s has its headers not captured',
      async (marked) => {
        const results = await runAnalyticsRule(
          guarded.rule,
          [],
          [trace(guarded, guarded.violating, marked)],
        );

        expect(results).toEqual([]);
      },
    );
  },
);

describe('rfc9110/proxy-may-transform-content-without-no-transform-directive on a trace through the analyzer', () => {
  // The proxy forwards a body that differs from the one it received, and
  // neither response carries Cache-Control. The rule reads Cache-Control only
  // on the response the proxy received, so only a gap there silences it.
  const transformed = (marked?: 'proxy hop' | 'next hop'): CapturedTrace => [
    hop(
      'user-agent',
      'proxy',
      { side: 'response', body: 'transformed' },
      {},
      marked === 'proxy hop' ? NOT_CAPTURED : undefined,
    ),
    hop(
      'proxy',
      'origin server',
      { side: 'response', body: 'original' },
      {},
      marked === 'next hop' ? NOT_CAPTURED : undefined,
    ),
  ];
  const rule = proxyMayTransformContentWithoutNoTransformDirective;

  it('reports a transformation when no hop is marked', async () => {
    expect(await runAnalyticsRule(rule, [], [transformed()])).toHaveLength(1);
  });

  it("stays silent when the next hop's response has its headers not captured", async () => {
    expect(await runAnalyticsRule(rule, [], [transformed('next hop')])).toEqual(
      [],
    );
  });

  it("still reports when only the proxy hop's response has its headers not captured", async () => {
    expect(
      await runAnalyticsRule(rule, [], [transformed('proxy hop')]),
    ).toHaveLength(1);
  });
});
