import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type CapturedTrace,
  type CapturedTransaction,
  type CaptureGap,
  constant,
  httpRule,
  NoopLogger,
  Thymian,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SqliteHttpTransactionRepository } from '../src/db/sqlite-http-transaction-repository.js';
import httpAnalyzerPlugin from '../src/index.js';

const NOT_CAPTURED: CaptureGap[] = [{ kind: 'headers-not-captured' }];

function transaction(gaps: {
  request?: CaptureGap[];
  response?: CaptureGap[];
}): CapturedTransaction {
  return {
    request: {
      data: {
        origin: 'https://example.com',
        path: '/',
        method: 'get',
        headers: {},
      },
      meta: {
        role: 'user-agent',
        ...(gaps.request && { captureGaps: gaps.request }),
      },
    },
    response: {
      data: { statusCode: 200, headers: {}, trailers: {}, duration: 1 },
      meta: {
        role: 'origin server',
        ...(gaps.response && { captureGaps: gaps.response }),
      },
    },
  };
}

type Gaps = CaptureGap[] | 'unset';
type Seen = { request: Gaps; response: Gaps };

const gapsOf = (meta: { captureGaps?: CaptureGap[] }): Gaps =>
  'captureGaps' in meta ? (meta.captureGaps ?? []) : 'unset';

const seenOf = (t: CapturedTransaction): Seen => ({
  request: gapsOf(t.request.meta),
  response: gapsOf(t.response.meta),
});

/**
 * Sends traffic through the analyzer's `http-analyzer.lint-analytics` action
 * with a rule that records the gaps it reads back, on traces and on single
 * transactions.
 */
async function readBack(traffic: {
  traces?: CapturedTrace[];
  transactions?: CapturedTransaction[];
}): Promise<{ traces: Seen[][]; transactions: Seen[] }> {
  const traces: Seen[][] = [];
  const transactions: Seen[] = [];

  const rule = httpRule('test/capture-gap-reader')
    .severity('error')
    .type('analytics')
    .rule((ctx) => [
      ...ctx.validateCapturedHttpTraces((trace) => {
        traces.push(trace.map(seenOf));
        return [];
      }),
      ...(ctx.validateCapturedHttpTransactions(constant(true), (t) => {
        transactions.push(seenOf(t));
        return [];
      }) as []),
    ])
    .done();

  const thymian = new Thymian();
  await thymian.register(httpAnalyzerPlugin, {}).ready();
  try {
    await thymian.emitter.emitAction(
      'http-analyzer.lint-analytics',
      { rules: [rule], ...traffic },
      { strategy: 'first' },
    );
  } finally {
    await thymian.close();
  }

  return { traces, transactions };
}

describe('Capture Gaps through http-analyzer.lint-analytics', () => {
  it('keeps the marker on a request and a response of a trace', async () => {
    const { traces } = await readBack({
      traces: [
        [
          transaction({ request: NOT_CAPTURED }),
          transaction({ response: NOT_CAPTURED }),
        ],
      ],
    });

    expect(traces).toEqual([
      [
        { request: NOT_CAPTURED, response: 'unset' },
        { request: 'unset', response: NOT_CAPTURED },
      ],
    ]);
  });

  it('keeps the marker on a request and a response of a single transaction', async () => {
    const { transactions } = await readBack({
      transactions: [
        transaction({ request: NOT_CAPTURED }),
        transaction({ response: NOT_CAPTURED }),
      ],
    });

    expect(transactions).toEqual([
      { request: NOT_CAPTURED, response: 'unset' },
      { request: 'unset', response: NOT_CAPTURED },
    ]);
  });

  it('reads an unmarked message back without captureGaps', async () => {
    const { traces, transactions } = await readBack({
      transactions: [transaction({})],
    });

    expect(transactions).toEqual([{ request: 'unset', response: 'unset' }]);
    expect(traces).toEqual([[{ request: 'unset', response: 'unset' }]]);
  });
});

describe('Capture Gaps on a database file created before them', () => {
  const logger = new NoopLogger();
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'thymian-capture-gap-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('gains the tables on init and reads old messages back with no gap', async () => {
    const path = join(dir, 'traffic.db');

    // A database file as the previous init SQL left it: no capture-gap tables.
    const old = new SqliteHttpTransactionRepository(path, logger);
    await old.init();
    old.db.exec('DROP TABLE request_capture_gap');
    old.db.exec('DROP TABLE response_capture_gap');
    const oldId = old.insertHttpTransaction(transaction({}));
    old.close();

    const upgraded = new SqliteHttpTransactionRepository(path, logger);
    await upgraded.init();
    const newId = upgraded.insertHttpTransaction(
      transaction({ request: NOT_CAPTURED }),
    );

    const before = upgraded.readTransactionById(oldId);
    const after = upgraded.readTransactionById(newId);
    upgraded.close();

    expect(before && seenOf(before)).toEqual({
      request: 'unset',
      response: 'unset',
    });
    expect(after && seenOf(after)).toEqual({
      request: NOT_CAPTURED,
      response: 'unset',
    });
  });
});
