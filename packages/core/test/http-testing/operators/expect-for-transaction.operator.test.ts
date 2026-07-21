import { AssertionError } from 'node:assert';

import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseStepTransaction,
  HttpTestContext,
  PipelineItem,
} from '../../../src/http-testing/http-test/index.js';
import { expectForTransactions } from '../../../src/http-testing/operators/expect-for-transaction.operator.js';
import type { ThymianHttpTransaction } from '../../../src/index.js';

function transaction(id: string): HttpTestCaseStepTransaction {
  return {
    source: { transactionId: id } as unknown as ThymianHttpTransaction,
  } as HttpTestCaseStepTransaction;
}

function step(
  ...transactions: HttpTestCaseStepTransaction[]
): HttpTestCaseStep {
  return { transactions } as unknown as HttpTestCaseStep;
}

function makeItem(steps: HttpTestCaseStep[]): PipelineItem<HttpTestCase> {
  const current = {
    start: 0,
    status: 'running',
    name: 'case',
    steps,
    results: [],
  } as unknown as HttpTestCase;

  const ctx = {
    logger: { warn: vi.fn() },
    fail: (failed: HttpTestCase) => {
      (failed as { status: string }).status = 'failed';
      return { current: failed, ctx };
    },
  } as unknown as HttpTestContext;

  return { current, ctx };
}

describe('expectForTransactions operator', () => {
  it('tags a failure with the last step index and the failing transaction index', async () => {
    const item = makeItem([
      step(transaction('tx-0')),
      step(transaction('tx-1')),
    ]);

    const fn = vi.fn(() => {
      throw new AssertionError({
        message: 'status should be 200',
        operator: 'strictEqual',
        expected: 200,
        actual: 500,
      });
    });

    const result = await lastValueFrom(
      of(item).pipe(expectForTransactions(fn)),
    );

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]).toMatchObject({
      type: 'assertion-failure',
      // Node augments the AssertionError message with an expected/actual diff.
      message: expect.stringContaining('status should be 200'),
      assertion: 'strictEqual',
      expected: 200,
      actual: 500,
      // last step (index 1), first transaction of that step (index 0)
      location: { stepIdx: 1, transactionIdx: 0 },
    });
  });

  it('reports the correct transaction index when a later transaction fails', async () => {
    const item = makeItem([step(transaction('tx-a'), transaction('tx-b'))]);

    // Pass on the first transaction, fail on the second.
    let call = 0;
    const fn = vi.fn(() => {
      if (call++ === 1) {
        throw new AssertionError({ message: 'boom', operator: 'ok' });
      }
    });

    const result = await lastValueFrom(
      of(item).pipe(expectForTransactions(fn)),
    );

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]).toMatchObject({
      type: 'assertion-failure',
      location: { stepIdx: 0, transactionIdx: 1 },
    });
  });

  it('does not tag or fail when every transaction passes', async () => {
    const item = makeItem([step(transaction('tx-0'))]);
    const fn = vi.fn();

    const result = await lastValueFrom(
      of(item).pipe(expectForTransactions(fn)),
    );

    expect(result.current.results).toHaveLength(0);
    expect(result.current.status).toBe('running');
  });
});
