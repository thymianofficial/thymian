import {
  matchObjects,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isSingleHttpTestCaseStep,
  type SingleHttpTestCaseStep,
  type ThymianHttpTransaction,
} from '../http-test-case.js';
import type { StringAndNumberProperties } from '../utils.js';

export function replayStepButExpectResponse<Steps extends HttpTestCaseStep[]>(
  filter: StringAndNumberProperties<ThymianHttpResponse>,
  fn: (
    step: Observable<
      HttpTestInstance<
        HttpTestCase<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>
      >
    >
  ) => Observable<
    HttpTestInstance<
      HttpTestCase<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>
    >
  >
): OperatorFunction<
  HttpTestInstance<HttpTestCase<[...Steps, SingleHttpTestCaseStep]>>,
  HttpTestInstance<
    HttpTestCase<[...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]>
  >
> {
  return mergeMap(({ ctx, curr }) => {
    const prevStep = curr.steps.at(-1);

    if (typeof prevStep === 'undefined') {
      throw new Error('Previous step must be defined.');
    }

    if (!isSingleHttpTestCaseStep(prevStep)) {
      throw new Error('Previous step must be a single test step.');
    }

    const { thymianReq, thymianRes } = prevStep.source;

    const transactions = ctx.format
      .getHttpTransactions()
      .map<ThymianHttpTransaction>(
        ([thymianReqId, thymianResId, transactionId]) => {
          const thymianReq =
            ctx.format.getNode<ThymianHttpRequest>(thymianReqId);
          const thymianRes =
            ctx.format.getNode<ThymianHttpResponse>(thymianResId);

          if (!(thymianReq && thymianRes)) {
            throw new Error(
              `Invalid HTTP Transaction with id ${transactionId}.`
            );
          }

          return {
            thymianReqId,
            thymianResId,
            transactionId,
            thymianReq,
            thymianRes,
          };
        }
      )
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
          curr,
          `A single transaction must be referenced but ${transactions.length} were referenced.`
        )
      );
    }

    const newStep: SingleHttpTestCaseStep = {
      type: 'single',
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      source: transactions[0]!,
      transactions: prevStep.transactions.map((transaction) => ({
        requestTemplate: transaction.requestTemplate,
        source: transactions[0],
      })),
    };

    curr.steps.push(newStep);

    return fn(
      of({
        ctx,
        curr: curr as unknown as HttpTestCase<
          [...Steps, SingleHttpTestCaseStep, SingleHttpTestCaseStep]
        >,
      })
    );
  });
}
