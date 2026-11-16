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
 * One recorded hop whose request and response were both produced by `role`.
 * `headers` and `gaps` go on the message side the rule compares.
 */
function hop(
  role: HttpParticipantRole,
  { side, method = 'get' }: GuardedRule,
  headers: Headers,
  gaps?: CaptureGap[],
): CapturedTransaction {
  const meta = { role, ...(gaps && { captureGaps: gaps }) };
  return {
    request: {
      data: {
        origin: 'https://example.com',
        path: '/',
        method,
        headers: side === 'request' ? headers : {},
      },
      meta: side === 'request' ? meta : { role },
    },
    response: {
      data: {
        statusCode: 200,
        headers: side === 'response' ? headers : {},
        trailers: {},
        duration: 1,
      },
      meta: side === 'response' ? meta : { role },
    },
  };
}

/** A trace through one proxy: the proxy's own hop, then the next one. */
function trace(
  guarded: GuardedRule,
  [proxyHop, nextHop]: Pair,
  marked?: 'proxy hop' | 'next hop',
): CapturedTrace {
  return [
    hop(
      'proxy',
      guarded,
      proxyHop,
      marked === 'proxy hop' ? NOT_CAPTURED : undefined,
    ),
    hop(
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
