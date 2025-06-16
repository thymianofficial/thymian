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
  ThymianHttpTestTransaction,
} from '../http-test-case.js';
import { isRecord } from '../utils.js';

export function isGroupedObservable<K, T>(
  value: unknown
): value is GroupedObservable<K, T> {
  return value instanceof Observable && 'key' in value;
}

export function isThymianHttpTestTransaction(
  value: unknown
): value is ThymianHttpTestTransaction {
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
  Input extends
    | ThymianHttpTestTransaction
    | GroupedObservable<string, ThymianHttpTestTransaction>
    | unknown
>(): OperatorFunction<
  HttpTestInstance<Input>,
  HttpTestInstance<
    HttpTestCase<
      Input extends ThymianHttpTestTransaction
        ? [SingleHttpTestCaseStep]
        : Input extends GroupedObservable<string, ThymianHttpTestTransaction>
        ? [GroupedHttpTestCaseStep]
        : [CustomHttpTestCaseStep<Input>]
    >
  >
> {
  // TODO
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return mergeMap(({ curr, ctx }) => {
    if (isGroupedObservable<string, ThymianHttpTestTransaction>(curr)) {
      return curr.pipe(
        reduce(
          (acc, curr) => {
            acc.curr.steps[0]!.source.transactions.push(curr);
            return acc;
          },
          {
            ctx,
            curr: {
              status: 'running',
              duration: performance.now(),
              results: [],
              steps: [
                {
                  type: 'grouped',
                  transactions: [],
                  source: {
                    key: curr.key,
                    transactions: [] as ThymianHttpTestTransaction[],
                  },
                } satisfies GroupedHttpTestCaseStep,
              ],
            },
          } satisfies HttpTestInstance<HttpTestCase<[GroupedHttpTestCaseStep]>>
        )
      );
    } else if (isThymianHttpTestTransaction(curr)) {
      return of({
        ctx,
        curr: {
          status: 'running',
          duration: performance.now(),
          results: [],
          steps: [
            {
              type: 'single',
              source: curr,
              transactions: [],
            },
          ],
        },
      } satisfies HttpTestInstance<HttpTestCase<[SingleHttpTestCaseStep]>>);
    } else {
      return of({
        ctx,
        curr: {
          status: 'running',
          duration: performance.now(),
          results: [],
          steps: [
            {
              type: 'custom',
              source: curr,
              transactions: [],
            },
          ],
        },
      } satisfies HttpTestInstance<HttpTestCase<[CustomHttpTestCaseStep<Input>]>>);
    }
  });
}
