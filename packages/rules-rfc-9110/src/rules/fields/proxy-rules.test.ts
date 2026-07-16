import type {
  CapturedTrace,
  CapturedTransaction,
  HttpParticipantRole,
  RuleFnResult,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import proxyMustForwardUnrecognizedHeaderFields from './field-names/proxy-must-forward-unrecognized-header-fields.rule.js';
import proxyMustNotChangeFieldLineOrder from './field-order/proxy-must-not-change-field-line-order.rule.js';

type AnalyzeOnlyRule = {
  analyzeRule?: (ctx: unknown) => RuleFnResult[];
};

/**
 * Runs a captured-trace analytics rule against a single synthetic trace by
 * providing a minimal context whose validateCapturedHttpTraces invokes the
 * rule's callback with that trace.
 */
function runOnTrace(
  rule: AnalyzeOnlyRule,
  trace: CapturedTrace,
): RuleFnResult[] {
  const analyze = rule.analyzeRule;
  if (!analyze) {
    throw new Error('rule is missing an analyzeRule');
  }
  const ctx = {
    validateCapturedHttpTraces: (
      validate: (t: CapturedTrace, location: string) => RuleFnResult[],
    ) => validate(trace, 'trace-location'),
  };
  return analyze(ctx);
}

/**
 * Builds one captured hop. In a captured trace a hop's meta.role identifies the
 * participant whose leg it is, so the proxy's own leg (the request it received)
 * carries role 'proxy' and the leg it forwarded onward carries the next hop's
 * role (e.g. 'origin server').
 */
function hop(
  role: HttpParticipantRole,
  headers: Record<string, string | string[] | undefined>,
): CapturedTransaction {
  return {
    request: {
      data: {
        method: 'get',
        origin: 'https://example.com',
        path: '/',
        headers,
      },
      meta: { role },
    },
    response: {
      data: { statusCode: 200, headers: {}, trailers: {}, duration: 1 },
      meta: { role },
    },
  };
}

const orderRule =
  proxyMustNotChangeFieldLineOrder as unknown as AnalyzeOnlyRule;
const forwardRule =
  proxyMustForwardUnrecognizedHeaderFields as unknown as AnalyzeOnlyRule;

describe('proxy-must-not-change-field-line-order', () => {
  it('flags a proxy that reorders same-name field lines when forwarding', () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] }),
      hop('origin server', { 'x-forwarded-for': ['10.0.0.2', '10.0.0.1'] }),
    ];

    const results = runOnTrace(orderRule, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('x-forwarded-for');
  });

  it('does not flag when the proxy preserves field-line order', () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] }),
      hop('origin server', { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] }),
    ];

    expect(runOnTrace(orderRule, trace)).toHaveLength(0);
  });
});

describe('proxy-must-forward-unrecognized-header-fields', () => {
  it('flags a field present on the received request but dropped when forwarded', () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-custom': 'v', accept: 'application/json' }),
      hop('origin server', { accept: 'application/json' }),
    ];

    const results = runOnTrace(forwardRule, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('x-custom');
  });

  it('does not flag when every received field is forwarded', () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-custom': 'v' }),
      hop('origin server', { 'x-custom': 'v' }),
    ];

    expect(runOnTrace(forwardRule, trace)).toHaveLength(0);
  });

  it('excepts Connection-listed and hop-by-hop fields, flagging only genuine drops', () => {
    const trace: CapturedTrace = [
      hop('proxy', { connection: 'x-hop', 'x-hop': 'v', 'x-real': 'v' }),
      hop('origin server', {}),
    ];

    const results = runOnTrace(forwardRule, trace);

    expect(results).toHaveLength(1);
    const message = results[0]?.violation?.message ?? '';
    expect(message).toContain('x-real');
    expect(message).not.toContain('x-hop');
    expect(message).not.toContain('connection');
  });
});
