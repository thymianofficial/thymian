import { type ThymianHttpTransaction } from '@thymian/core';
import {
  type GroupedObservable,
  map,
  mergeMap,
  type OperatorFunction,
  toArray,
} from 'rxjs';

import type {
  GroupedHttpTestCaseStep,
  HttpTestCase,
  HttpTestCaseStepTransaction,
} from '../http-test/http-test-case.js';
import type { HttpTestContextLocals } from '../http-test/http-test-context.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function mapToGroupedTestCase<
  Locals extends HttpTestContextLocals
>(): OperatorFunction<
  GroupedObservable<string, PipelineItem<ThymianHttpTransaction, Locals>>,
  PipelineItem<HttpTestCase<[GroupedHttpTestCaseStep]>, Locals>
> {
  return mergeMap((group) => {
    return group.pipe(
      toArray(),
      map((elements) => {
        if (elements.length === 0) {
          throw new Error('Empty group');
        }

        const envelope: PipelineItem<
          HttpTestCase<[GroupedHttpTestCaseStep]>,
          Locals
        > = {
          ctx: elements[0]!.ctx,
          current: {
            status: 'running' as const,
            name: group.key,
            start: performance.now(),
            results: [],
            steps: [
              {
                type: 'grouped',
                transactions: [] as HttpTestCaseStepTransaction[],
                source: {
                  key: group.key,
                  transactions: elements.map((el) => el.current),
                },
              },
            ],
          },
        };

        return envelope;
      })
    );
  });
}
