import {
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import { map, type OperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  SingleHttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { HttpTestContextLocals } from '../http-test/http-test-context.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function mapToTestCase<
  Locals extends HttpTestContextLocals,
>(): OperatorFunction<
  PipelineItem<ThymianHttpTransaction, Locals>,
  PipelineItem<HttpTestCase<[SingleHttpTestCaseStep]>, Locals>
> {
  return map(({ current, ctx }) => ({
    ctx,
    current: {
      name: thymianHttpTransactionToString(
        current.thymianReq,
        current.thymianRes,
      ),
      status: 'running',
      start: performance.now(),
      results: [],
      steps: [
        {
          type: 'single',
          source: current,
          transactions: [],
        },
      ],
    },
  }));
}
