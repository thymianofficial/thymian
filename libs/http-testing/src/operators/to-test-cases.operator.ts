import {
  type GroupedObservable,
  mergeMap,
  Observable,
  of,
  type OperatorFunction,
  reduce,
} from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  CustomHttpTestCaseStep,
  GroupedHttpTestCaseStep,
  HttpTestCase,
  SingleHttpTestCaseStep,
  ThymianHttpTransaction,
} from '../http-test-case.js';
import { isRecord } from '../utils.js';
import type { HttpTestContext } from '../http-test-context.js';

export function isGroupedObservable<K, T>(
  value: unknown
): value is GroupedObservable<K, T> {
  return value instanceof Observable && 'key' in value;
}

export function isThymianHttpTestTransaction(
  value: unknown
): value is ThymianHttpTransaction {
  return (
    isRecord(value) &&
    'thymianReqId' in value &&
    typeof value.thymianReqId === 'string' &&
    'thymianReq' in value &&
    typeof value.thymianReq === 'object' &&
    'thymianResId' in value &&
    typeof value.thymianResId === 'string' &&
    'thymianRes' in value &&
    typeof value.thymianRes === 'object'
  );
}

export function toTestCases<
  T,
  Input extends
    | HttpTestInstance<ThymianHttpTransaction>
    | GroupedObservable<string, HttpTestInstance<ThymianHttpTransaction>>
    | HttpTestInstance<T>
>(): OperatorFunction<
  Input,
  HttpTestInstance<
    HttpTestCase<
      Input extends HttpTestInstance<ThymianHttpTransaction>
        ? [SingleHttpTestCaseStep]
        : Input extends GroupedObservable<
            string,
            HttpTestInstance<ThymianHttpTransaction>
          >
        ? [GroupedHttpTestCaseStep]
        : [CustomHttpTestCaseStep<T>]
    >
  >
> {
  // TODO
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return mergeMap((input) => {
    if (
      isGroupedObservable<string, HttpTestInstance<ThymianHttpTransaction>>(
        input
      )
    ) {
      return input.pipe(
        reduce(
          (acc, value) => {
            acc.curr.steps[0]!.source.transactions.push(value.curr);
            acc.ctx = value.ctx;

            return acc;
          },
          {
            ctx: {} as HttpTestContext,
            curr: {
              status: 'running',
              duration: performance.now(),
              results: [],
              steps: [
                {
                  type: 'grouped',
                  transactions: [],
                  source: {
                    key: input.key,
                    transactions: [] as ThymianHttpTransaction[],
                  },
                } satisfies GroupedHttpTestCaseStep,
              ],
            },
          } satisfies HttpTestInstance<HttpTestCase<[GroupedHttpTestCaseStep]>>
        )
      );
    } else if ('curr' in input && isThymianHttpTestTransaction(input.curr)) {
      return of({
        ctx: input.ctx,
        curr: {
          status: 'running',
          duration: performance.now(),
          results: [],
          steps: [
            {
              type: 'single',
              source: input.curr,
              transactions: [],
            },
          ],
        },
      } satisfies HttpTestInstance<HttpTestCase<[SingleHttpTestCaseStep]>>);
    } else {
      return of({
        ctx: input.ctx,
        curr: {
          status: 'running',
          duration: performance.now(),
          results: [],
          steps: [
            {
              type: 'custom',
              source: input.curr as T,
              transactions: [],
            },
          ],
        },
      } satisfies HttpTestInstance<HttpTestCase<[CustomHttpTestCaseStep<T>]>>);
    }
  });
}
