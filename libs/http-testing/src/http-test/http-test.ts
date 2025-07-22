import { type ThymianHttpTransaction } from '@thymian/core';
import { from } from 'rxjs';

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
  ctx: HttpTestContext<Locals>
) => Promise<HttpTestResult>;

export function httpTest<
  Locals extends HttpTestContextLocals = HttpTestContextLocals
>(name: string, fn: HttpTestPipeline<Locals>): HttpTestRunnerFn<Locals> {
  return (ctx) => {
    const start = performance.now();
    const testCases: HttpTestCase[] = [];

    const transactions = ctx.format.getThymianHttpTransactions();
    const envelopes = transactions.map<
      PipelineItem<ThymianHttpTransaction, Locals>
    >((transaction) => ({
      current: transaction,
      ctx,
    }));

    return new Promise((resolve, reject) => {
      fn(from(envelopes)).subscribe({
        next: (e) => {
          e.current.status =
            e.current.status === 'running' ? 'passed' : e.current.status;
          e.current.end = performance.now();
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
