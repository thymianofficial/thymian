import { type ThymianFormat } from '@thymian/core';
import { Observable, of } from 'rxjs';

import type { HttpTestCase } from './http-test-case.js';
import type { HttpTestContext } from './http-test-context.js';

export type HttpTestResult = {
  name: string;
  duration: number;
  cases: HttpTestCase[];
};

export type HttpTest<T> = {
  ctx: HttpTestContext;
  curr: T;
};

export type HttpTestFn = (
  test: Observable<HttpTest<ThymianFormat>>
) => Observable<HttpTest<HttpTestCase>>;

export type HttpTestRunnerFn = (
  ctx: HttpTestContext
) => Promise<HttpTestResult>;

export function test(name: string, testFn: HttpTestFn): HttpTestRunnerFn {
  return (ctx) => {
    const start = performance.now();

    const result: HttpTestResult = {
      name,
      duration: 0,
      cases: [],
    };

    return new Promise<HttpTestResult>((resolve, reject) => {
      testFn(
        of({ ctx, curr: ctx.format } satisfies HttpTest<ThymianFormat>)
      ).subscribe({
        next: (t) => result.cases.push(t.curr),
        complete: () => {
          result.duration = performance.now() - start;
          resolve(result);
        },
        error: (err) => reject(err),
      });
    });
  };
}
