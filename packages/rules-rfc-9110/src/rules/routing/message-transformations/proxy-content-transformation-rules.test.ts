import type {
  CapturedTrace,
  CapturedTransaction,
  HttpParticipantRole,
  HttpResponse,
  RuleFnResult,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import proxyMayTransformContentWithoutNoTransformDirective from './proxy-may-transform-content-without-no-transform-directive.rule.js';
import proxyMustNotTransformContentWithNoTransformDirective from './proxy-must-not-transform-content-with-no-transform-directive.rule.js';

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

type CapturedResponse = Partial<
  Pick<HttpResponse, 'body' | 'bodyEncoding' | 'headers'>
>;

/**
 * Builds one captured transaction whose request and response are both stamped
 * with the given role.
 */
function hop(
  role: HttpParticipantRole,
  response: CapturedResponse,
): CapturedTransaction {
  return {
    request: {
      data: { method: 'get', origin: 'https://example.com', path: '/' },
      meta: { role },
    },
    response: {
      data: {
        statusCode: 200,
        headers: {},
        trailers: {},
        duration: 1,
        ...response,
      },
      meta: { role },
    },
  };
}

/**
 * A proxy hop: the proxy forwarded `forwarded` downstream (its own leg) after
 * receiving `received` from the origin server (the onward leg).
 */
function proxyTrace(
  forwarded: CapturedResponse,
  received: CapturedResponse,
): CapturedTrace {
  return [hop('proxy', forwarded), hop('origin server', received)];
}

const noTransform = { 'cache-control': 'no-transform' };

const mustRule =
  proxyMustNotTransformContentWithNoTransformDirective as unknown as AnalyzeOnlyRule;
const mayRule =
  proxyMayTransformContentWithoutNoTransformDirective as unknown as AnalyzeOnlyRule;

describe('proxy-must-not-transform-content-with-no-transform-directive', () => {
  it('does not report a proxy that forwards no-transform content unchanged', () => {
    const trace = proxyTrace(
      { body: 'hello' },
      { body: 'hello', headers: noTransform },
    );

    expect(runOnTrace(mustRule, trace)).toHaveLength(0);
  });

  it('reports a proxy that changes no-transform content', () => {
    const trace = proxyTrace(
      { body: 'HELLO' },
      { body: 'hello', headers: noTransform },
    );

    const results = runOnTrace(mustRule, trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toBe(
      'Proxy transformed the content of a response carrying Cache-Control: no-transform.',
    );
  });

  it('reports changed content when no-transform sits inside a comma list', () => {
    const trace = proxyTrace(
      { body: 'HELLO' },
      {
        body: 'hello',
        headers: { 'cache-control': 'max-age=60, no-transform' },
      },
    );

    expect(runOnTrace(mustRule, trace)).toHaveLength(1);
  });

  it('reports a proxy that strips no-transform before changing the content', () => {
    const trace = proxyTrace(
      { body: 'HELLO', headers: {} },
      { body: 'hello', headers: noTransform },
    );

    expect(runOnTrace(mustRule, trace)).toHaveLength(1);
  });

  it('does not report changed content without the no-transform directive', () => {
    const trace = proxyTrace(
      { body: 'HELLO' },
      { body: 'hello', headers: { 'cache-control': 'max-age=60' } },
    );

    expect(runOnTrace(mustRule, trace)).toHaveLength(0);
  });

  it('does not report a hop whose body was not captured on either side', () => {
    expect(
      runOnTrace(
        mustRule,
        proxyTrace({}, { body: 'hello', headers: noTransform }),
      ),
    ).toHaveLength(0);
    expect(
      runOnTrace(
        mustRule,
        proxyTrace({ body: 'hello' }, { headers: noTransform }),
      ),
    ).toHaveLength(0);
  });

  it('does not report the same bytes recorded as base64 and as text', () => {
    const trace = proxyTrace(
      { body: 'aGVsbG8=', bodyEncoding: 'base64' },
      { body: 'hello', headers: noTransform },
    );

    expect(runOnTrace(mustRule, trace)).toHaveLength(0);
  });
});

describe('proxy-may-transform-content-without-no-transform-directive', () => {
  it('does not hint on the same bytes recorded as base64 and as text', () => {
    const trace = proxyTrace(
      { body: 'aGVsbG8=', bodyEncoding: 'base64' },
      { body: 'hello' },
    );

    expect(runOnTrace(mayRule, trace)).toHaveLength(0);
  });
});
