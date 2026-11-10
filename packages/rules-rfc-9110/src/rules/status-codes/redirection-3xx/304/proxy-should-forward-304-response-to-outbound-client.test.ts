import type {
  CapturedTrace,
  CapturedTransaction,
  HttpParticipantRole,
} from '@thymian/core';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './proxy-should-forward-304-response-to-outbound-client.rule.js';

const runOnTrace = (trace: CapturedTrace) =>
  runInContext('analytics', rule, { traces: [trace] });

/**
 * Builds one leg of a captured trace. meta.role identifies the PRODUCER of
 * each message: on the client-facing leg the request is produced by the
 * user agent and the response by the proxy; on the origin-facing leg the
 * request is produced by the proxy and the response by the origin server.
 */
function leg(opts: {
  requestRole: HttpParticipantRole;
  responseRole: HttpParticipantRole;
  requestHeaders?: Record<string, string | string[] | undefined>;
  statusCode: number;
}): CapturedTransaction {
  return {
    request: {
      data: {
        method: 'get',
        origin: 'https://example.com',
        path: '/',
        headers: opts.requestHeaders ?? {},
      },
      meta: { role: opts.requestRole },
    },
    response: {
      data: {
        statusCode: opts.statusCode,
        headers: {},
        trailers: {},
        duration: 1,
      },
      meta: { role: opts.responseRole },
    },
  };
}

function proxiedTrace(opts: {
  conditionalHeaders?: Record<string, string>;
  clientFacingStatusCode: number;
  originFacingStatusCode: number;
}): CapturedTrace {
  return [
    leg({
      requestRole: 'user-agent',
      responseRole: 'proxy',
      requestHeaders: opts.conditionalHeaders,
      statusCode: opts.clientFacingStatusCode,
    }),
    leg({
      requestRole: 'proxy',
      responseRole: 'origin server',
      requestHeaders: opts.conditionalHeaders,
      statusCode: opts.originFacingStatusCode,
    }),
  ];
}

describe('proxy-should-forward-304-response-to-outbound-client', () => {
  it('flags a proxy that answers a conditional request with 200 despite an upstream 304', async () => {
    const trace = proxiedTrace({
      conditionalHeaders: { 'if-none-match': '"abc"' },
      clientFacingStatusCode: 200,
      originFacingStatusCode: 304,
    });

    const results = await runOnTrace(trace);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toContain('304');
    expect(results[0]?.violation?.message).toContain('200');
  });

  it('recognizes if-modified-since as a conditional request', async () => {
    const trace = proxiedTrace({
      conditionalHeaders: {
        'if-modified-since': 'Tue, 01 Jul 2025 00:00:00 GMT',
      },
      clientFacingStatusCode: 200,
      originFacingStatusCode: 304,
    });

    expect(await runOnTrace(trace)).toHaveLength(1);
  });

  it('does not flag a proxy that forwards the 304 to the outbound client', async () => {
    const trace = proxiedTrace({
      conditionalHeaders: { 'if-none-match': '"abc"' },
      clientFacingStatusCode: 304,
      originFacingStatusCode: 304,
    });

    expect(await runOnTrace(trace)).toHaveLength(0);
  });

  it('does not flag a non-conditional request even when the upstream leg is a 304', async () => {
    const trace = proxiedTrace({
      clientFacingStatusCode: 200,
      originFacingStatusCode: 304,
    });

    expect(await runOnTrace(trace)).toHaveLength(0);
  });

  it('does not flag an unproxied trace (single client-origin transaction)', async () => {
    const trace: CapturedTrace = [
      leg({
        requestRole: 'user-agent',
        responseRole: 'origin server',
        requestHeaders: { 'if-none-match': '"abc"' },
        statusCode: 304,
      }),
    ];

    expect(await runOnTrace(trace)).toHaveLength(0);
  });

  it('does not flag when the upstream response is not a 304', async () => {
    const trace = proxiedTrace({
      conditionalHeaders: { 'if-none-match': '"abc"' },
      clientFacingStatusCode: 200,
      originFacingStatusCode: 200,
    });

    expect(await runOnTrace(trace)).toHaveLength(0);
  });
});
