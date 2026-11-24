import type { CapturedTrace } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { hop } from '../../../../test/captured-hop.js';
import { runAnalyticsRule } from '../../../../test/run-analytics-rule.js';
import proxyMayTransformContentWithoutNoTransformDirective from './proxy-may-transform-content-without-no-transform-directive.rule.js';
import proxyMustNotTransformContentWithNoTransformDirective from './proxy-must-not-transform-content-with-no-transform-directive.rule.js';

type CapturedResponse = {
  headers?: Record<string, string>;
  body?: string;
  bodyEncoding?: string;
};

/**
 * A proxy hop: the proxy forwarded `forwarded` downstream to the user agent
 * after receiving `received` from the origin server.
 */
function proxyTrace(
  forwarded: CapturedResponse,
  received: CapturedResponse,
): CapturedTrace {
  return [
    hop('user-agent', 'proxy', forwarded.headers ?? {}, {
      side: 'response',
      body: forwarded.body,
      bodyEncoding: forwarded.bodyEncoding,
    }),
    hop('proxy', 'origin server', received.headers ?? {}, {
      side: 'response',
      body: received.body,
      bodyEncoding: received.bodyEncoding,
    }),
  ];
}

const noTransform = { 'cache-control': 'no-transform' };

const mustRule = proxyMustNotTransformContentWithNoTransformDirective;
const mayRule = proxyMayTransformContentWithoutNoTransformDirective;

describe('proxy-must-not-transform-content-with-no-transform-directive', () => {
  it('does not report a proxy that forwards no-transform content unchanged', async () => {
    const trace = proxyTrace(
      { body: 'hello' },
      { body: 'hello', headers: noTransform },
    );

    expect(await runAnalyticsRule(mustRule, [], [trace])).toHaveLength(0);
  });

  it('reports a proxy that changes no-transform content', async () => {
    const trace = proxyTrace(
      { body: 'HELLO' },
      { body: 'hello', headers: noTransform },
    );

    const results = await runAnalyticsRule(mustRule, [], [trace]);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toBe(
      'Proxy transformed the content of a response carrying Cache-Control: no-transform.',
    );
  });

  it('reports changed content when no-transform sits inside a comma list', async () => {
    const trace = proxyTrace(
      { body: 'HELLO' },
      {
        body: 'hello',
        headers: { 'cache-control': 'max-age=60, no-transform' },
      },
    );

    expect(await runAnalyticsRule(mustRule, [], [trace])).toHaveLength(1);
  });

  it('reports a proxy that strips no-transform before changing the content', async () => {
    const trace = proxyTrace(
      { body: 'HELLO', headers: {} },
      { body: 'hello', headers: noTransform },
    );

    expect(await runAnalyticsRule(mustRule, [], [trace])).toHaveLength(1);
  });

  it('does not report changed content without the no-transform directive', async () => {
    const trace = proxyTrace(
      { body: 'HELLO' },
      { body: 'hello', headers: { 'cache-control': 'max-age=60' } },
    );

    expect(await runAnalyticsRule(mustRule, [], [trace])).toHaveLength(0);
  });

  it('does not report a hop whose body was not captured on either side', async () => {
    expect(
      await runAnalyticsRule(
        mustRule,
        [],
        [proxyTrace({}, { body: 'hello', headers: noTransform })],
      ),
    ).toHaveLength(0);
    expect(
      await runAnalyticsRule(
        mustRule,
        [],
        [proxyTrace({ body: 'hello' }, { headers: noTransform })],
      ),
    ).toHaveLength(0);
  });

  it('does not report the same bytes recorded as base64 and as text', async () => {
    const trace = proxyTrace(
      { body: 'aGVsbG8=', bodyEncoding: 'base64' },
      { body: 'hello', headers: noTransform },
    );

    expect(await runAnalyticsRule(mustRule, [], [trace])).toHaveLength(0);
  });
});

describe('proxy-may-transform-content-without-no-transform-directive', () => {
  it('does not hint on the same bytes recorded as base64 and as text', async () => {
    const trace = proxyTrace(
      { body: 'aGVsbG8=', bodyEncoding: 'base64' },
      { body: 'hello' },
    );

    expect(await runAnalyticsRule(mayRule, [], [trace])).toHaveLength(0);
  });
});
