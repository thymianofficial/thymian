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
  Locals extends HttpTestContextLocals
>(): OperatorFunction<
  PipelineItem<ThymianHttpTransaction, Locals>,
  PipelineItem<HttpTestCase<[SingleHttpTestCaseStep]>, Locals>
> {
  return map(({ current, ctx }) => ({
    ctx,
    current: {
      name: thymianHttpTransactionToString(
        current.thymianReq,
        current.thymianRes
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

// import { isRecord, type ThymianHttpTransaction } from '@thymian/core';
// import {
//   type GroupedObservable,
//   map,
//   mergeMap,
//   Observable,
//   of,
//   type OperatorFunction,
//   reduce,
//   tap,
//   toArray,
// } from 'rxjs';
//
// import type {
//   CustomHttpTestCaseStep,
//   GroupedHttpTestCaseStep,
//   HttpTestCase,
//   HttpTestCaseStepTransaction,
//   SingleHttpTestCaseStep,
// } from '../http-test/http-test-case.js';
// import type {
//   HttpTestContext,
//   HttpTestContextLocals,
// } from '../http-test/http-test-context.js';
// import type { PipelineEnvelope } from '../http-test/http-test-pipeline.js';
//
// export function isGroupedObservable<K, T>(
//   value: unknown
// ): value is GroupedObservable<K, T> {
//   return value instanceof Observable && 'key' in value;
// }
//
// export function isThymianHttpTransaction(
//   value: unknown
// ): value is ThymianHttpTransaction {
//   return (
//     isRecord(value) &&
//     'thymianReqId' in value &&
//     typeof value.thymianReqId === 'string' &&
//     'thymianReq' in value &&
//     typeof value.thymianReq === 'object' &&
//     'thymianResId' in value &&
//     typeof value.thymianResId === 'string' &&
//     'thymianRes' in value &&
//     typeof value.thymianRes === 'object'
//   );
// }
//
// export function mapToTestCase<
//   T,
//   Locals extends HttpTestContextLocals,
//   Input extends
//     | PipelineEnvelope<ThymianHttpTransaction, Locals>
//     | GroupedObservable<
//         string,
//         PipelineEnvelope<ThymianHttpTransaction, Locals>
//       >
//     | PipelineEnvelope<T, Locals>
// >(): OperatorFunction<
//   Input,
//   PipelineEnvelope<
//     HttpTestCase<
//       [
//         Input extends PipelineEnvelope<ThymianHttpTransaction, Locals>
//           ? SingleHttpTestCaseStep
//           : Input extends GroupedObservable<
//               string,
//               PipelineEnvelope<ThymianHttpTransaction, Locals>
//             >
//           ? GroupedHttpTestCaseStep
//           : CustomHttpTestCaseStep<T>
//       ]
//     >,
//     Locals
//   >
// > {
//   return mergeMap((input) => {
//     if (
//       isGroupedObservable<
//         string,
//         PipelineEnvelope<ThymianHttpTransaction, Locals>
//       >(input)
//     ) {
//       return input.pipe(
//         toArray(),
//         map((elements) => {
//           if (elements.length === 0) {
//             throw new Error('Empty group');
//           }
//
//           const envelope: PipelineEnvelope<
//             HttpTestCase<[GroupedHttpTestCaseStep]>
//           > = {
//             ctx: elements[0]!.ctx,
//             current: {
//               status: 'running' as const,
//               start: performance.now(),
//               results: [],
//               steps: [
//                 {
//                   type: 'grouped',
//                   transactions: [] as HttpTestCaseStepTransaction[],
//                   source: {
//                     key: input.key,
//                     transactions: elements.map((el) => el.current),
//                   },
//                 },
//               ],
//             },
//           };
//
//           return envelope;
//         })
//       );
//     } else if ('current' in input && isThymianHttpTransaction(input.current)) {
//       return of({
//         ctx: input.ctx,
//         current: {
//           status: 'running',
//           start: performance.now(),
//           results: [],
//           steps: [
//             {
//               type: 'single',
//               source: input.current,
//               transactions: [],
//             },
//           ],
//         },
//       });
//     } else {
//       return of({
//         ctx: input.ctx,
//         current: {
//           status: 'running',
//           start: performance.now(),
//           results: [],
//           steps: [
//             {
//               type: 'custom',
//               source: input.current as T,
//               transactions: [],
//             },
//           ],
//         },
//       });
//     }
//   });
// }
