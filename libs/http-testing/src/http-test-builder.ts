import {
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';

import type { AssertionFn } from './assertions/assertion.js';
import { assertResponseBody } from './assertions/response-body.assertion.js';
import { assertStatusCode } from './assertions/status-code.assertion.js';
import type { HttpTestContext } from './http-test/context.js';
import type {
  HttpTestCase,
  HttpTestSuite,
  HttpTestTransaction,
  SequenceHttpTest,
  SingleHttpTest,
} from './http-test/http-test.js';
import type { OverrideHttpRequestFn } from './http-test/override.js';
import type { TransactionsFilterFn } from './http-test/transaction-filter.js';
import type { HttpRequest } from './request.js';

export class SequenceHttpTestBuilder<Ctx extends HttpTestContext> {
  private readonly test: SequenceHttpTest;

  constructor(name: string) {
    this.test = {
      assertions: [],
      context: {},
      contextFns: [],
      name,
      results: [],
      status: 'pending',
      steps: [],
      type: 'sequence',
    };
  }

  description(description: string): this {
    this.test.description = description;

    return this;
  }

  step<TName extends string>(
    name: TName extends keyof Ctx['steps'] ? never : TName,
    fn: (builder: SingleHttpTestBuilder<Ctx>) => SingleHttpTest
  ): SequenceHttpTestBuilder<
    Ctx & {
      steps: Record<TName, HttpTestTransaction>;
    }
  > {
    this.test.steps.push(fn(new SingleHttpTestBuilder(name)));

    return this as unknown as SequenceHttpTestBuilder<
      Ctx & {
        steps: Record<TName, HttpTestTransaction>;
      }
    >;
  }

  context<
    Context extends
      | Record<PropertyKey, unknown>
      | ((...args: unknown[]) => unknown)
  >(
    context: Context
  ): SequenceHttpTestBuilder<
    Ctx &
      (Context extends (...args: unknown[]) => unknown
        ? Awaited<ReturnType<Context>>
        : Context)
  > {
    if (typeof context === 'function') {
      this.test.contextFns.push(context);
    } else {
      this.test.context = {
        ...this.test.context,
        ...context,
      };
    }

    return this as unknown as SequenceHttpTestBuilder<
      Ctx &
        (Context extends (...args: unknown[]) => unknown
          ? Awaited<ReturnType<Context>>
          : Context)
    >;
  }

  expect(fn: AssertionFn<HttpTestTransaction[]>): this {
    this.test.assertions.push(fn);

    return this;
  }

  done(): SequenceHttpTest {
    return this.test;
  }
}

export type AssertionOptions = {
  body: boolean;
  headers: boolean;
  statusCode: boolean;
};

type ExtendContext<
  Ctx extends HttpTestContext,
  Context extends HttpTestContext | ((...args: unknown[]) => HttpTestContext)
> = Ctx &
  (Context extends (...args: unknown[]) => HttpTestContext
    ? Awaited<ReturnType<Context>>
    : Context);

export class SingleHttpTestBuilder<Ctx extends HttpTestContext> {
  private readonly test: SingleHttpTest;
  private assertionOptions: AssertionOptions = {
    body: true,
    headers: true,
    statusCode: true,
  };

  constructor(name: string) {
    this.test = {
      generate: () => [],
      assertions: [],
      context: {},
      contextFns: [],
      name,
      override: [],
      results: [],
      status: 'pending',
      type: 'single',
    };
  }

  context<
    Context extends HttpTestContext | ((...args: unknown[]) => HttpTestContext)
  >(context: Context): SingleHttpTestBuilder<ExtendContext<Ctx, Context>> {
    if (typeof context === 'function') {
      this.test.contextFns.push(context);
    } else {
      this.test.context = {
        ...this.test.context,
        ...context,
      };
    }

    return this as unknown as SingleHttpTestBuilder<
      ExtendContext<Ctx, Context>
    >;
  }

  description(description: string): this {
    this.test.description = description;

    return this;
  }

  get ctx(): Ctx {
    return this.test.context as Ctx;
  }

  forTransactions(filterFn: TransactionsFilterFn): this {
    this.test.generate = function (format) {
      const testCases = [] as Omit<HttpTestCase, 'response'>[];

      const transactions = format.getHttpTransactions();
      for (const [reqId, resId] of transactions) {
        const req = format.getNode<ThymianHttpRequest>(reqId);
        const res = format.getNode<ThymianHttpResponse>(resId);

        if (!filterFn(req, res, { resId, reqId, format })) {
          continue;
        }

        // TODO: generate requests
        testCases.push({
          reqId,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          request: {},
          resId,
        });
      }

      return testCases;
    };

    return this;
  }

  expect(
    fn: AssertionFn<{
      testCase: HttpTestCase;
      test: SingleHttpTest;
      format: ThymianFormat;
    }>
  ): this;
  expect(options: Partial<AssertionOptions>): this;
  expect(
    fnOrOptions:
      | AssertionFn<{
          testCase: HttpTestCase;
          test: SingleHttpTest;
          format: ThymianFormat;
        }>
      | Partial<AssertionOptions>
  ): this {
    if (typeof fnOrOptions === 'function') {
      this.test.assertions.push(fnOrOptions);
    } else {
      this.assertionOptions = {
        ...this.assertionOptions,
        ...fnOrOptions,
      };
    }

    return this;
  }

  override<Part extends keyof HttpRequest>(
    part: Part,
    fn: OverrideHttpRequestFn<Ctx, HttpRequest[Part]>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part, fn });

    return this;
  }

  overrideBody(fn: OverrideHttpRequestFn<Ctx, HttpRequest['body']>): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'body', fn });

    return this;
  }

  overrideQuery(fn: OverrideHttpRequestFn<Ctx, HttpRequest['query']>): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'query', fn });

    return this;
  }

  overrideHeaders(
    fn: OverrideHttpRequestFn<Ctx, HttpRequest['headers']>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'headers', fn });

    return this;
  }

  done(): SingleHttpTest {
    if (this.assertionOptions.body) {
      this.test.assertions.push(assertResponseBody);
    }

    if (this.assertionOptions.statusCode) {
      this.test.assertions.push(assertStatusCode);
    }

    return this.test;
  }
}

export class HttpTestSuiteBuilder<
  Ctx extends HttpTestContext = HttpTestContext
> {
  private readonly suite: HttpTestSuite;

  constructor(name: string) {
    this.suite = {
      name,
      tests: [],
      context: {},
      contextFns: [],
    };
  }

  context<
    Context extends
      | Record<PropertyKey, unknown>
      | ((...args: unknown[]) => unknown)
  >(
    context: Context
  ): HttpTestSuiteBuilder<
    Ctx &
      (Context extends (...args: unknown[]) => unknown
        ? Awaited<ReturnType<Context>>
        : Context)
  > {
    if (typeof context === 'function') {
      this.suite.contextFns.push(context);
    } else {
      this.suite.context = {
        ...this.suite.context,
        ...context,
      };
    }

    return this as unknown as HttpTestSuiteBuilder<
      Ctx &
        (Context extends (...args: unknown[]) => unknown
          ? Awaited<ReturnType<Context>>
          : Context)
    >;
  }

  test(
    name: string,
    fn: (t: SingleHttpTestBuilder<Ctx>) => SingleHttpTest
  ): this {
    this.suite.tests.push(fn(new SingleHttpTestBuilder(name)));

    return this;
  }

  sequence(
    name: string,
    fn: (builder: SequenceHttpTestBuilder<Ctx>) => SequenceHttpTest
  ): this {
    this.suite.tests.push(fn(new SequenceHttpTestBuilder(name)));

    return this;
  }

  done(): HttpTestSuite {
    return this.suite;
  }
}

export function suite<Ctx extends HttpTestContext>(
  name: string
): HttpTestSuiteBuilder<Ctx> {
  return new HttpTestSuiteBuilder(name);
}

export function test<Ctx extends HttpTestContext>(
  name: string,
  fn: (t: SingleHttpTestBuilder<Ctx>) => SingleHttpTest
): SingleHttpTest {
  return fn(new SingleHttpTestBuilder(name));
}

export function sequence<Ctx extends HttpTestContext>(
  name: string,
  fn: (t: SequenceHttpTestBuilder<Ctx>) => SequenceHttpTest
): SequenceHttpTest {
  return fn(new SequenceHttpTestBuilder(name));
}
