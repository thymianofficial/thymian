import { type ThymianFormat } from '@thymian/core';
import { Observable, of } from 'rxjs';

import type { HttpTestCase } from './http-test-case.js';
import type { HttpTestContext } from './http-test-context.js';
import {
  defineStep,
  type DefineTestOptions,
} from './operators/define-test.operator.js';

export type HttpTestResult = {
  name: string;
  duration: number;
  cases: HttpTestCase[];
};

export type HttpTestInstance<T> = {
  ctx: HttpTestContext;
  curr: T;
};

export type HttpTestFn = (
  test: Observable<HttpTestInstance<ThymianFormat>>
) => Observable<HttpTestInstance<HttpTestCase>>;

export type HttpTestRunnerFn = (
  ctx: HttpTestContext
) => Promise<HttpTestResult>;

export function httpTest(
  name: string,
  options: Partial<DefineTestOptions>
): HttpTestRunnerFn;
export function httpTest(name: string, testFn: HttpTestFn): HttpTestRunnerFn;
export function httpTest(
  name: string,
  testFnOrOptions: Partial<DefineTestOptions> | HttpTestFn = {}
): HttpTestRunnerFn {
  return (ctx) => {
    const testFn =
      typeof testFnOrOptions === 'function'
        ? testFnOrOptions
        : (test: Observable<HttpTestInstance<ThymianFormat>>) =>
            test.pipe(defineStep(testFnOrOptions));

    const start = performance.now();

    const result: HttpTestResult = {
      name,
      duration: 0,
      cases: [],
    };

    return new Promise<HttpTestResult>((resolve, reject) => {
      testFn(
        of({ ctx, curr: ctx.format } satisfies HttpTestInstance<ThymianFormat>)
      ).subscribe({
        next: (t) => {
          t.curr.status =
            t.curr.status === 'running' ? 'passed' : t.curr.status;
          t.curr.duration = performance.now() - t.curr.duration;
          result.cases.push(t.curr);
        },
        complete: () => {
          result.duration = performance.now() - start;
          resolve(result);
        },
        error: (err) => reject(err),
      });
    });
  };
}
