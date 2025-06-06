import type {
  SequenceHttpTest,
  SingleHttpTest,
  SingleHttpTestResult,
  TestResult,
} from '../http-test/http-test.js';
import { type Logger, ThymianFormat } from '@thymian/core';
import type { HttpRequestExecutor } from './request-executor.js';
import type { HookRunner } from './hook-runner.js';
import type { HttpTestContext } from '../http-test/context.js';
import { SingleTestRunner } from './single-test-runner.js';

export type SequenceTestStep = {
  testResult: SingleHttpTestResult;
  children: SequenceTestStep[];
};

export class SequenceTestRunner {
  constructor(
    private readonly test: SequenceHttpTest,
    private readonly logger: Logger,
    private readonly executor: HttpRequestExecutor,
    private readonly hookRunner: HookRunner,
    private readonly format: ThymianFormat
  ) {}

  async run(): Promise<unknown> {
    const start = performance.now();

    const context = await this.createContext();

    const results = [] as TestResult[];

    const previousSteps: SequenceTestStep[] = [];

    for (let i = 0; i < this.test.steps.length; ++i) {
      const step = this.test.steps[i]!;

      if (i === 0) {
        const singleTestResult = await new SingleTestRunner(
          {
            ...step,
            contextFns: [...step.contextFns, ...this.test.contextFns],
          },
          this.logger,
          this.executor,
          this.hookRunner,
          this.format
        ).run();

        singleTestResult.forEach((testResult) =>
          previousSteps.push({ testResult, children: [] })
        );
      } else {
        const r = await this.runForEach(step, previousSteps, i, context);

        r.forEach((testResult) =>
          previousSteps.push({ testResult, children: [] })
        );
      }
    }

    const duration = performance.now() - start;

    this.logger.debug(
      `Run Sequence HTTP Test "${this.test.name}" in ${duration}ms.`
    );

    return {
      duration,
      results,
      status: 'pass',
    };
  }

  async runForEach(
    test: SingleHttpTest,
    previous: SequenceTestStep[],
    depth: number,
    context: HttpTestContext
  ): Promise<SingleHttpTestResult[]> {
    if (depth < 1) {
      return new SingleTestRunner(
        {
          ...test,
          contextFns: [...test.contextFns, () => context],
        },
        this.logger,
        this.executor,
        this.hookRunner,
        this.format
      ).run(context);
    } else {
      return (
        await Promise.all(
          previous.map((prev) =>
            this.runForEach(test, previous, depth - 1, {
              ...context,
              steps: {
                ...(context.steps ?? {}),
                [prev.testResult.testName]: prev.testResult.transaction,
              },
            })
          )
        )
      ).flat();
    }
  }

  private async createContext(
    base: Record<PropertyKey, unknown> = {}
  ): Promise<HttpTestContext> {
    let context: HttpTestContext = {
      fail(msg: string | undefined): never {
        throw new Error(msg);
      },
      format: this.format,
      pass(): never {
        throw new Error();
      },
      skip(): never {
        throw new Error();
      },
      ...base,
    };

    for await (const fn of this.test.contextFns) {
      context = {
        ...context,
        ...(await fn(context)),
      };
    }

    return context;
  }
}
