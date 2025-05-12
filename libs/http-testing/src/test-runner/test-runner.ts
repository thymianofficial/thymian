import { AssertionError } from 'node:assert';

import { type Logger, type PartialBy, ThymianFormat } from '@thymian/core';

import type { AssertionResult } from '../assertions/assertion.js';
import type { HttpTestContext } from '../http-test/context.js';
import type {
  HttpTest,
  HttpTestCase,
  HttpTestResult,
  HttpTestStatus,
  SequenceHttpTest,
  SingleHttpTest,
  TestResult,
} from '../http-test/http-test.js';
import type { HttpRequest } from '../request.js';
import type { HookRunner } from './hook-runner.js';
import type { HttpRequestExecutor } from './request-executor.js';

export class TestRunner {
  constructor(
    private readonly logger: Logger,
    private readonly executor: HttpRequestExecutor,
    private readonly hookRunner: HookRunner,
    private readonly format: ThymianFormat
  ) {}

  async runHttpTestCase(
    testCase: PartialBy<HttpTestCase, 'response'>
  ): Promise<HttpTestCase> {
    let request = testCase.request;

    request = await this.hookRunner.beforeEachRequest(request, testCase);

    const response = await this.executor.request(request);

    return {
      ...testCase,
      request,
      response,
    };
  }

  async runSingleHttpTest(test: SingleHttpTest): Promise<HttpTestResult> {
    const start = performance.now();

    const context = await this.createContext(test);

    const results = [] as TestResult[];
    let status = 'pass' as HttpTestStatus;
    const testCases = test.generate(this.format, context);

    for await (const tc of testCases) {
      const testCase = await this.runHttpTestCase(tc);

      const assertionResults = await this.assertTestCase(test, testCase);

      assertionResults.forEach((assertionResult) => {
        if (assertionResult.failed) {
          status = 'fail';

          results.push({
            message: assertionResult.message,
            type: 'assertion-failure',
          });
        }
      });
    }

    const duration = performance.now() - start;

    this.logger.debug(`Run single HTTP Test "${test.name}" in ${duration}ms.`);

    return {
      duration,
      results,
      status,
    };
  }

  async runSequenceHttpTest(test: SequenceHttpTest): Promise<HttpTestResult> {
    const start = performance.now();

    const context = await this.createContext(test);

    const results = [] as TestResult[];

    for await (const step of test.steps) {
      const result = await this.runSingleHttpTest({
        ...step,
        context: {
          ...context,
          ...step.context,
        },
      });

      results.push(...result.results);
    }

    const duration = performance.now() - start;

    this.logger.debug(
      `Run Sequence HTTP Test "${test.name}" in ${duration}ms.`
    );

    return {
      duration,
      results,
      status: 'pass',
    };
  }

  private async createContext(test: HttpTest): Promise<HttpTestContext> {
    const contexts = (await Promise.all(
      test.contextFns.map((fn) => fn())
    )) as HttpTestContext[];

    return contexts.reduce(
      (context, c) => ({
        ...context,
        ...c,
      }),
      test.context
    );
  }

  // TODO: context
  private overrideRequest(
    request: HttpRequest,
    test: SingleHttpTest
  ): HttpRequest {
    return test.override.reduce((req, override) => {
      return req;
    }, request);
  }

  private async assertTestCase(
    test: SingleHttpTest,
    testCase: HttpTestCase
  ): Promise<AssertionResult[]> {
    const assertionResults = [] as AssertionResult[];

    for await (const assertion of test.assertions ?? []) {
      try {
        const results = await assertion({
          testCase,
          test,
          format: this.format,
        });

        if (Array.isArray(results)) {
          assertionResults.push(...results);
        } else if (typeof results === 'object') {
          assertionResults.push(results);
        }
      } catch (err: unknown) {
        if (err instanceof AssertionError) {
          assertionResults.push({
            message: err.message,
          });
        } else {
          throw err;
        }
      }
    }

    return assertionResults;
  }
}
