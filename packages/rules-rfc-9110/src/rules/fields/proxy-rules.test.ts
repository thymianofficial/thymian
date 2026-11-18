import type {
  CapturedTrace,
  CapturedTransaction,
  CaptureGap,
  HttpParticipantRole,
  Rule,
  RuleFnResult,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { runAnalyticsRule } from '../../../test/run-analytics-rule.js';
import proxyMustForwardUnrecognizedHeaderFields from './field-names/proxy-must-forward-unrecognized-header-fields.rule.js';
import proxyMustNotChangeFieldLineOrder from './field-order/proxy-must-not-change-field-line-order.rule.js';

/**
 * Runs a captured-trace analytics rule against a single trace through the
 * real analyzer repository and `AnalyticsApiContext`.
 */
const runOnTrace = (
  rule: Rule,
  trace: CapturedTrace,
): Promise<RuleFnResult[]> => runAnalyticsRule(rule, [], [trace]);

const NOT_CAPTURED: CaptureGap[] = [{ kind: 'headers-not-captured' }];

/**
 * Builds one captured hop from `from` to `to`. `meta.role` names the
 * participant that sent each message, so the request carries `from` and the
 * response `to`, as in recorded traffic.
 */
function hop(
  from: HttpParticipantRole,
  to: HttpParticipantRole,
  headers: Record<string, string | string[] | undefined>,
  captureGaps?: CaptureGap[],
): CapturedTransaction {
  return {
    request: {
      data: {
        method: 'get',
        origin: 'https://example.com',
        path: '/',
        headers,
      },
      meta: { role: from, ...(captureGaps && { captureGaps }) },
    },
    response: {
      data: { statusCode: 200, headers: {}, trailers: {}, duration: 1 },
      meta: { role: to },
    },
  };
}

const orderRule = proxyMustNotChangeFieldLineOrder;
const forwardRule = proxyMustForwardUnrecognizedHeaderFields;

describe('proxy-must-not-change-field-line-order', () => {
  it('flags a proxy that reorders same-name field lines when forwarding', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'proxy', {
        'x-forwarded-for': ['10.0.0.1', '10.0.0.2'],
      }),
      hop('proxy', 'origin server', {
        'x-forwarded-for': ['10.0.0.2', '10.0.0.1'],
      }),
    ];

    const results = await runOnTrace(orderRule, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('x-forwarded-for');
  });

  it('does not flag when the proxy preserves field-line order', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'proxy', {
        'x-forwarded-for': ['10.0.0.1', '10.0.0.2'],
      }),
      hop('proxy', 'origin server', {
        'x-forwarded-for': ['10.0.0.1', '10.0.0.2'],
      }),
    ];

    expect(await runOnTrace(orderRule, trace)).toHaveLength(0);
  });

  it('does not judge a gateway that reorders field lines', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'gateway', {
        'x-forwarded-for': ['10.0.0.1', '10.0.0.2'],
      }),
      hop('gateway', 'origin server', {
        'x-forwarded-for': ['10.0.0.2', '10.0.0.1'],
      }),
    ];

    expect(await runOnTrace(orderRule, trace)).toHaveLength(0);
  });
});

describe('proxy-must-forward-unrecognized-header-fields', () => {
  it('flags a field present on the received request but dropped when forwarded', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'proxy', {
        'x-custom': 'v',
        accept: 'application/json',
      }),
      hop('proxy', 'origin server', { accept: 'application/json' }),
    ];

    const results = await runOnTrace(forwardRule, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('x-custom');
  });

  it('does not flag when every received field is forwarded', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'proxy', { 'x-custom': 'v' }),
      hop('proxy', 'origin server', { 'x-custom': 'v' }),
    ];

    expect(await runOnTrace(forwardRule, trace)).toHaveLength(0);
  });

  it('does not judge a gateway that drops a received field', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'gateway', { 'x-custom': 'v', accept: '*/*' }),
      hop('gateway', 'origin server', { accept: '*/*' }),
    ];

    expect(await runOnTrace(forwardRule, trace)).toHaveLength(0);
  });

  it('excepts Connection-listed and hop-by-hop fields, flagging only genuine drops', async () => {
    const trace: CapturedTrace = [
      hop('user-agent', 'proxy', {
        connection: 'x-hop',
        'x-hop': 'v',
        'x-real': 'v',
      }),
      hop('proxy', 'origin server', { host: 'example.com' }),
    ];

    const results = await runOnTrace(forwardRule, trace);

    expect(results).toHaveLength(1);
    const message = results[0]?.violation?.message ?? '';
    expect(message).toContain('x-real');
    expect(message).not.toContain('x-hop');
    expect(message).not.toContain('connection');
  });

  // The analyzer reads a hop recorded without headers back as an empty object;
  // it stores no header whose value is undefined. Without a marker that hop
  // was captured and carried no field, so every received field was dropped.
  it.each([
    ['an empty header object', {}],
    ['only undefined header values', { accept: undefined }],
  ])(
    'flags every received field when the forwarded hop was recorded with %s',
    async (_, forwardedHeaders) => {
      const trace: CapturedTrace = [
        hop('user-agent', 'proxy', { 'x-custom': 'v' }),
        hop('proxy', 'origin server', forwardedHeaders),
      ];

      const results = await runOnTrace(forwardRule, trace);

      expect(results).toHaveLength(1);
      expect(results[0]?.violation?.message).toContain('x-custom');
    },
  );

  it.each([
    ['an empty header object', {}],
    ['only undefined header values', { accept: undefined }],
  ])(
    'does not flag when the forwarded hop has %s and its headers not captured',
    async (_, forwardedHeaders) => {
      const trace: CapturedTrace = [
        hop('user-agent', 'proxy', { 'x-custom': 'v' }),
        hop('proxy', 'origin server', forwardedHeaders, NOT_CAPTURED),
      ];

      expect(await runOnTrace(forwardRule, trace)).toHaveLength(0);
    },
  );
});
