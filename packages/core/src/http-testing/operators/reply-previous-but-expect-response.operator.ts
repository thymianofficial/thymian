import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import { matchObjects, type ThymianHttpResponse } from '../../index.js';
import type { StringAndNumberProperties } from '../../utils.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  type HttpTestCaseStepTransaction,
  type SingleHttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';
import {
  isFailedTestCase,
  isSingleHttpTestCaseStep,
  isSkippedTestCase,
} from '../http-test/index.js';

export function replayStepButExpectResponse<Steps extends HttpTestCaseStep[]>(
  filter: StringAndNumberProperties<ThymianHttpResponse>,
  fn: (
    step: Observable<
      PipelineItem<
        HttpTestCase<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>
      >
    >,
  ) => Observable<
    PipelineItem<
      HttpTestCase<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>
    >
  >,
): OperatorFunction<
  PipelineItem<HttpTestCase<[...Steps, SingleHttpTestCaseStep]>>,
  PipelineItem<
    HttpTestCase<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>
  >
> {
  return mergeMap(({ ctx, current }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return of({
        current: current as HttpTestCase<
          [...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]
        >,
        ctx,
      });
    }

    const prevStep = current.steps.at(-1);

    if (typeof prevStep === 'undefined') {
      throw new Error('Previous step must be defined.');
    }

    if (!isSingleHttpTestCaseStep(prevStep)) {
      throw new Error('Previous step must be a single test step.');
    }

    const { thymianReq, thymianRes } = prevStep.source;

    const transactions = ctx.format
      .getThymianHttpTransactions()
      .filter((transaction) => {
        return (
          matchObjects(transaction.thymianReq, {
            host: thymianReq.host,
            port: thymianReq.port,
            protocol: thymianReq.protocol,
            path: thymianReq.path,
            method: thymianReq.method,
            bodyRequired: thymianReq.bodyRequired,
            mediaType: thymianReq.mediaType,
          }) &&
          matchObjects(transaction.thymianRes, {
            statusCode: thymianRes.statusCode,
            mediaType: thymianRes.mediaType,
            ...(filter ?? {}),
          })
        );
      });

    if (transactions.length !== 1) {
      return of(
        ctx.skip<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          current,
          `A single transaction must be referenced but ${transactions.length} were referenced.`,
        ),
      );
    }

    const newStep: SingleHttpTestCaseStep = {
      type: 'single',
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      source: transactions[0]!,
      transactions: prevStep.transactions.map(
        (transaction) =>
          ({
            requestTemplate: transaction.requestTemplate,
            source: transactions[0],
          }) as HttpTestCaseStepTransaction,
      ),
    };

    current.steps.push(newStep);

    return fn(
      of({
        ctx,
        current: current as HttpTestCase<
          [...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]
        >,
      }),
    );
  });
}
