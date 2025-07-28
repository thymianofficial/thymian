import type { ThymianHttpTransaction } from '@thymian/core';
import {
  and,
  type HttpFilterExpression,
  type RequestFilterExpression,
} from '@thymian/http-filter';
import { filter, map, type MonoTypeOperatorFunction, tap } from 'rxjs';

import {
  type GenerateRequestsOptions,
  type HttpTestCase,
  type HttpTestCaseStepTransaction,
  type HttpTestPipeline,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
} from '../http-test/index.js';
import {
  expectForTransactions,
  generateRequests,
  mapToTestCase,
  replayStep,
  runRequests,
  type RunRequestsOptions,
} from '../operators/index.js';
import type { BuilderPipeline } from './builder-pipeline.js';
import { compileRequestScopedExpressionToRequestFilter } from './compilers/request-scoped-to-request-filter.js';
import { compileResponseScopedToResponseChecker } from './compilers/response-scoped-to-response-checker.js';
import { compileResponseScopedExpressionToResponseFilter } from './compilers/response-scoped-to-response-filter.js';
import { compileResponseScopedExpressionToTransactionValidationFn } from './compilers/response-scoped-to-transaction-validator.js';
import { overrideTemplate } from './override-request-template.js';
import { ReplyStepBuilder } from './reply-step-builder.js';

export type RunOptions = GenerateRequestsOptions & Partial<RunRequestsOptions>;

export interface FilterRequests {
  forRequestsWith(filter: HttpFilterExpression): FilterResponses;
}

export interface FilterResponses {
  forResponsesWith(filter: HttpFilterExpression): RunRequests;
}

export interface RunRequests {
  set(filter: RequestFilterExpression, value: unknown): RunRequests;

  tap(fn: () => void): RunRequests;

  run(
    options?: RunOptions
  ): ExpectOrStep<[Required<HttpTestCaseStepTransaction>]>;
}

export interface ExpectOrStep<
  Transactions extends Required<HttpTestCaseStepTransaction>[]
> {
  expectForTransactions(
    ...filters: HttpFilterExpression[]
  ): ExpectOrStep<Transactions>;

  replayStep(
    step: (step: ReplyStepBuilder) => BuilderPipeline
  ): ExpectOrStep<[...Transactions, Required<HttpTestCaseStepTransaction>]>;

  skipIf(
    expression: HttpFilterExpression,
    message?: string
  ): ExpectOrStep<Transactions>;

  done(): HttpTestPipeline<Record<PropertyKey, unknown>>;

  transactions(
    fn: (transactions: Transactions) => void
  ): ExpectOrStep<Transactions>;
}

export class SingleStepTestBuilder<
  Transactions extends Required<HttpTestCaseStepTransaction>[]
> implements
    FilterRequests,
    FilterResponses,
    RunRequests,
    ExpectOrStep<Transactions>
{
  protected readonly pipeline: BuilderPipeline = [];

  #requestOverrides: BuilderPipeline = [];

  forRequestsWith(
    httpFilter: HttpFilterExpression
  ): SingleStepTestBuilder<Transactions> {
    this.pipeline.push(
      filter<PipelineItem<ThymianHttpTransaction>>(({ current, ctx }) => {
        const filterFn = compileRequestScopedExpressionToRequestFilter(
          httpFilter,
          ctx.format
        );
        const responses = ctx.format.getNeighboursOfType(
          current.thymianReqId,
          'http-response'
        );

        return filterFn(current.thymianReq, current.thymianReqId, responses);
      })
    );

    return this;
  }

  tap(fn: () => void): RunRequests {
    this.pipeline.push(tap(fn));
    return this;
  }

  forResponsesWith(
    httpFilter: HttpFilterExpression
  ): SingleStepTestBuilder<Transactions> {
    this.pipeline.push(
      filter<PipelineItem<ThymianHttpTransaction>>(({ current, ctx }) => {
        const filterFn = compileResponseScopedExpressionToResponseFilter(
          httpFilter,
          ctx.format
        );

        return filterFn(
          current.thymianRes,
          current.thymianResId,
          current.thymianReq,
          current.thymianReqId
        );
      })
    );

    return this;
  }

  set(
    filter: RequestFilterExpression,
    value: unknown
  ): SingleStepTestBuilder<Transactions> {
    const operator: MonoTypeOperatorFunction<PipelineItem<HttpTestCase>> = map(
      ({ current, ctx }) => {
        if (current.steps[0]?.transactions[0]) {
          current.steps[0].transactions[0].requestTemplate = overrideTemplate(
            current.steps[0].transactions[0].requestTemplate,
            filter,
            value
          );
        }

        return { current, ctx };
      }
    );

    this.#requestOverrides.push(operator);

    return this;
  }

  skipIf(
    expression: HttpFilterExpression,
    message?: string
  ): ExpectOrStep<Transactions> {
    const operator: MonoTypeOperatorFunction<PipelineItem<HttpTestCase>> = map(
      ({ current, ctx }) => {
        const step = current.steps.at(-1);

        if (step) {
          const response = step.transactions[0]?.response;

          if (
            response &&
            compileResponseScopedToResponseChecker(expression, response)
          ) {
            return ctx.skip(current, message);
          }
        }

        return { current, ctx };
      }
    );

    this.pipeline.push(operator);

    return this;
  }

  run(
    options: RunOptions = {}
  ): SingleStepTestBuilder<[Required<HttpTestCaseStepTransaction>]> {
    this.pipeline.push(
      mapToTestCase(),
      generateRequests(options),
      ...this.#requestOverrides,
      runRequests(options)
    );

    return this as unknown as SingleStepTestBuilder<
      [Required<HttpTestCaseStepTransaction>]
    >;
  }

  expectForTransactions(
    ...filters: HttpFilterExpression[]
  ): ExpectOrStep<Transactions> {
    const validate = compileResponseScopedExpressionToTransactionValidationFn(
      and(...filters)
    );

    const fn: MonoTypeOperatorFunction<PipelineItem<HttpTestCase>> =
      expectForTransactions((transaction) => validate(transaction));

    this.pipeline.push(fn);

    return this;
  }

  done(): HttpTestPipeline<Record<PropertyKey, unknown>> {
    return (transactions) =>
      transactions.pipe(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        ...this.pipeline
      );
  }

  replayStep(
    step: (step: ReplyStepBuilder) => BuilderPipeline
  ): SingleStepTestBuilder<
    [...Transactions, Required<HttpTestCaseStepTransaction>]
  > {
    this.pipeline.push(
      replayStep((step1) =>
        step1.pipe(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          ...step(new ReplyStepBuilder())
        )
      )
    );

    return this as unknown as SingleStepTestBuilder<
      [...Transactions, Required<HttpTestCaseStepTransaction>]
    >;
  }

  transactions(
    fn: (transactions: Transactions) => void
  ): SingleStepTestBuilder<Transactions> {
    const operator: MonoTypeOperatorFunction<PipelineItem<HttpTestCase>> = map(
      ({ current, ctx }) => {
        if (isSkippedTestCase(current) || isFailedTestCase(current)) {
          return { current, ctx };
        }

        const transactions = current.steps.flatMap((step) => step.transactions);

        try {
          fn(transactions as Transactions);
        } catch (e) {
          if (e instanceof Error) {
            return ctx.fail(current, e.message);
          } else {
            return ctx.fail(current, 'unknown error.');
          }
        }

        return { current, ctx };
      }
    );

    this.pipeline.push(operator);

    return this;
  }
}

export function singleTestCase(): FilterRequests {
  return new SingleStepTestBuilder();
}
