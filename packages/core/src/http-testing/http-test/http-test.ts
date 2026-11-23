import { from } from 'rxjs';

import {
  isTestableTransaction,
  type ThymianHttpTransaction,
} from '../../index.js';
import { type HttpTestCase } from './http-test-case.js';
import type {
  HttpTestContext,
  HttpTestContextLocals,
} from './http-test-context.js';
import type { HttpTestPipeline, PipelineItem } from './http-test-pipeline.js';

export type HttpTestResult = {
  name: string;
  duration: number;
  cases: HttpTestCase[];
};

export type HttpTestRunnerFn<Locals extends HttpTestContextLocals> = (
  ctx: HttpTestContext<Locals>,
) => Promise<HttpTestResult>;

export function httpTest<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
>(name: string, fn: HttpTestPipeline<Locals>): HttpTestRunnerFn<Locals> {
  return (ctx) => {
    const start = performance.now();
    const testCases: HttpTestCase[] = [];

    // A `default` Transaction names no status a request could be aimed at,
    // so it never becomes a test case (ADR-0027).
    const transactions = ctx.format
      .getThymianHttpTransactions()
      .filter(isTestableTransaction);
    const items = transactions.map<
      PipelineItem<ThymianHttpTransaction, Locals>
    >((transaction) => ({
      current: transaction,
      ctx,
    }));

    return new Promise((resolve, reject) => {
      fn(from(items)).subscribe({
        next: (e) => {
          e.current.status =
            e.current.status === 'running' ? 'passed' : e.current.status;
          e.current.end ??= performance.now();

          testCases.push(e.current);
        },
        complete: () => {
          resolve({
            name,
            cases: testCases,
            duration: performance.now() - start,
          });
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  };
}
