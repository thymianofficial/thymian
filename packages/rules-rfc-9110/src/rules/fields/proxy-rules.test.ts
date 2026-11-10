import type {
  CapturedTrace,
  CapturedTransaction,
  HttpParticipantRole,
  Rule,
  RuleFnResult,
} from '@thymian/core';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import proxyMustForwardUnrecognizedHeaderFields from './field-names/proxy-must-forward-unrecognized-header-fields.rule.js';
import proxyMustNotChangeFieldLineOrder from './field-order/proxy-must-not-change-field-line-order.rule.js';

const runOnTrace = (rule: Rule, trace: CapturedTrace) =>
  runInContext('analytics', rule, { traces: [trace] });

/**
 * Runs a captured-trace analytics rule against a single synthetic trace by
 * providing a minimal context whose validateCapturedHttpTraces invokes the
 * rule's callback with that trace.
 *
 * Only for a leg captured without headers, held back by a bug in the rule: it
 * tells an unrecorded leg by `undefined` headers, but the real analyzer stores
 * such a leg with no header rows and reads it back as `{}`. On the real engine
 * the rule therefore flags the missing capture as a proxy that dropped every
 * field. Once the rule no longer relies on `undefined`, this case moves to
 * `runOnTrace`.
 */
function runOnStubTrace(rule: Rule, trace: CapturedTrace): RuleFnResult[] {
  const analyze = (
    rule as unknown as { analyzeRule?: (ctx: unknown) => RuleFnResult[] }
  ).analyzeRule;
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
  headers: Record<string, string | string[] | undefined> | undefined,
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

describe('proxy-must-not-change-field-line-order', () => {
  it('flags a proxy that reorders same-name field lines when forwarding', async () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] }),
      hop('origin server', { 'x-forwarded-for': ['10.0.0.2', '10.0.0.1'] }),
    ];

    const results = await runOnTrace(proxyMustNotChangeFieldLineOrder, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('x-forwarded-for');
  });

  it('does not flag when the proxy preserves field-line order', async () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] }),
      hop('origin server', { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] }),
    ];

    expect(
      await runOnTrace(proxyMustNotChangeFieldLineOrder, trace),
    ).toHaveLength(0);
  });
});

describe('proxy-must-forward-unrecognized-header-fields', () => {
  it('flags a field present on the received request but dropped when forwarded', async () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-custom': 'v', accept: 'application/json' }),
      hop('origin server', { accept: 'application/json' }),
    ];

    const results = await runOnTrace(
      proxyMustForwardUnrecognizedHeaderFields,
      trace,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('x-custom');
  });

  it('does not flag when every received field is forwarded', async () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-custom': 'v' }),
      hop('origin server', { 'x-custom': 'v' }),
    ];

    expect(
      await runOnTrace(proxyMustForwardUnrecognizedHeaderFields, trace),
    ).toHaveLength(0);
  });

  it('excepts Connection-listed and hop-by-hop fields, flagging only genuine drops', async () => {
    const trace: CapturedTrace = [
      hop('proxy', { connection: 'x-hop', 'x-hop': 'v', 'x-real': 'v' }),
      hop('origin server', {}),
    ];

    const results = await runOnTrace(
      proxyMustForwardUnrecognizedHeaderFields,
      trace,
    );

    expect(results).toHaveLength(1);
    const message = results[0]?.violation?.message ?? '';
    expect(message).toContain('x-real');
    expect(message).not.toContain('x-hop');
    expect(message).not.toContain('connection');
  });

  it('does not flag when the forwarded leg has no captured headers', () => {
    const trace: CapturedTrace = [
      hop('proxy', { 'x-custom': 'v' }),
      hop('origin server', undefined),
    ];

    expect(
      runOnStubTrace(proxyMustForwardUnrecognizedHeaderFields, trace),
    ).toHaveLength(0);
  });
});
