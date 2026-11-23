import type { CapturedTrace, RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { hop } from '../../../../../test/captured-hop.js';
import proxyShouldForward304 from './proxy-should-forward-304-response-to-outbound-client.rule.js';

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

const rule = proxyShouldForward304 as unknown as AnalyzeOnlyRule;

function proxiedTrace(opts: {
  conditionalHeaders?: Record<string, string>;
  clientFacingStatusCode: number;
  originFacingStatusCode: number;
}): CapturedTrace {
  return [
    hop('user-agent', 'proxy', opts.conditionalHeaders ?? {}, {
      statusCode: opts.clientFacingStatusCode,
    }),
    hop('proxy', 'origin server', opts.conditionalHeaders ?? {}, {
      statusCode: opts.originFacingStatusCode,
    }),
  ];
}

describe('proxy-should-forward-304-response-to-outbound-client', () => {
  it('flags a proxy that answers a conditional request with 200 despite an upstream 304', () => {
    const trace = proxiedTrace({
      conditionalHeaders: { 'if-none-match': '"abc"' },
      clientFacingStatusCode: 200,
      originFacingStatusCode: 304,
    });

    const results = runOnTrace(rule, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('304');
    expect(results[0]?.violation?.message).toContain('200');
  });

  it('recognizes if-modified-since as a conditional request', () => {
    const trace = proxiedTrace({
      conditionalHeaders: {
        'if-modified-since': 'Tue, 01 Jul 2025 00:00:00 GMT',
      },
      clientFacingStatusCode: 200,
      originFacingStatusCode: 304,
    });

    expect(runOnTrace(rule, trace)).toHaveLength(1);
  });

  it('does not flag a proxy that forwards the 304 to the outbound client', () => {
    const trace = proxiedTrace({
      conditionalHeaders: { 'if-none-match': '"abc"' },
      clientFacingStatusCode: 304,
      originFacingStatusCode: 304,
    });

    expect(runOnTrace(rule, trace)).toHaveLength(0);
  });

  it('does not flag a non-conditional request even when the upstream hop is a 304', () => {
    const trace = proxiedTrace({
      clientFacingStatusCode: 200,
      originFacingStatusCode: 304,
    });

    expect(runOnTrace(rule, trace)).toHaveLength(0);
  });

  it('does not flag an unproxied trace (single client-origin transaction)', () => {
    const trace: CapturedTrace = [
      hop(
        'user-agent',
        'origin server',
        { 'if-none-match': '"abc"' },
        {
          statusCode: 304,
        },
      ),
    ];

    expect(runOnTrace(rule, trace)).toHaveLength(0);
  });

  it('does not flag when the upstream response is not a 304', () => {
    const trace = proxiedTrace({
      conditionalHeaders: { 'if-none-match': '"abc"' },
      clientFacingStatusCode: 200,
      originFacingStatusCode: 200,
    });

    expect(runOnTrace(rule, trace)).toHaveLength(0);
  });
});
