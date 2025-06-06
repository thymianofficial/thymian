import {
  type PartialBy,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';

import type { AssertionFn } from '../assertions/assertion.js';
import type { HttpTestContext } from '../http-test/context.js';
import type { SingleHttpTest } from '../http-test/http-test.js';
import type { OverrideHttpRequestFn } from '../http-test/override.js';
import type { TransactionsFilterFn } from '../http-test/transaction-filter.js';
import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';
import type { HttpResponse } from '../rxjs/http-response.js';
import type { KeysWithStringOrNumberValue } from '../utils.js';
import type { ExtendContext } from './types.js';

export class SingleHttpTestBuilder<
  Ctx extends HttpTestContext,
  AssertionContext = never,
  FilterProperties extends (keyof ThymianHttpRequest)[] = []
> {
  private readonly test: SingleHttpTest;

  constructor(name: string) {
    this.test = {
      assertions: [],
      contextFns: [],
      description: '',
      name,
      override: [],
      results: [],
      status: 'pending',
      type: 'single',
      transactionFilter: () => true,
    };
  }

  context<
    const Context extends Record<PropertyKey, unknown> | ((ctx: Ctx) => unknown)
  >(
    context: Context
  ): SingleHttpTestBuilder<
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    ExtendContext<Ctx, Context>,
    AssertionContext,
    FilterProperties
  > {
    if (typeof context === 'function') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.test.contextFns.push(context);
    } else {
      this.test.contextFns.push(() => context);
    }

    return this as unknown as SingleHttpTestBuilder<
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      ExtendContext<Ctx, Context>,
      AssertionContext,
      FilterProperties
    >;
  }

  description(description: string): this {
    this.test.description = description;

    return this;
  }

  filterHttpTransactions(
    filterFn: TransactionsFilterFn<Ctx>
  ): SingleHttpTestBuilder<
    Ctx,
    {
      thymianReq: ThymianHttpRequest;
      thymianRes: ThymianHttpResponse;
      reqId: string;
      resId: string;
    },
    FilterProperties
  > {
    this.test.transactionFilter = filterFn;

    return this as SingleHttpTestBuilder<
      Ctx,
      {
        thymianReq: ThymianHttpRequest;
        thymianRes: ThymianHttpResponse;
        reqId: string;
        resId: string;
      },
      FilterProperties
    >;
  }

  groupHttpRequestsBy<
    const Filter extends KeysWithStringOrNumberValue<ThymianHttpRequest>[]
  >(
    filter: Filter
  ): SingleHttpTestBuilder<
    Ctx,
    { requests: { req: ThymianHttpRequest; reqId: string }[] },
    Filter
  > {
    this.test.groupHttpRequestsBy = filter;

    return this as unknown as SingleHttpTestBuilder<
      Ctx,
      { requests: { req: ThymianHttpRequest; reqId: string }[] },
      Filter
    >;
  }

  mapGroupTo(
    fn: (
      keys: Pick<ThymianHttpRequest, FilterProperties[number]>,
      requests: { req: ThymianHttpRequest; reqId: string }[],
      ctx: Ctx
    ) => PartialBy<
      HttpRequestTemplate,
      Extract<FilterProperties[number], keyof HttpRequestTemplate>
    >
  ): SingleHttpTestBuilder<
    Ctx,
    {
      requests: { req: ThymianHttpRequest; reqId: string }[];
      keys: Pick<ThymianHttpRequest, FilterProperties[number]>;
    },
    FilterProperties
  > {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.mapGroupsToHttpRequests = fn;

    return this as SingleHttpTestBuilder<
      Ctx,
      {
        requests: { req: ThymianHttpRequest; reqId: string }[];
        keys: Pick<ThymianHttpRequest, FilterProperties[number]>;
      },
      FilterProperties
    >;
  }

  expect(
    fn: AssertionFn<
      {
        request: HttpRequestTemplate;
        response: HttpResponse;
      } & AssertionContext & {
          ctx: Ctx;
        }
    >
  ): this {
    this.test.assertions.push(fn);

    return this;
  }

  override<Part extends keyof HttpRequestTemplate>(
    part: Part,
    fn: OverrideHttpRequestFn<Ctx, HttpRequestTemplate[Part]>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part, fn });

    return this;
  }

  overrideBody(
    fn: OverrideHttpRequestFn<Ctx, HttpRequestTemplate['body']>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'body', fn });

    return this;
  }

  overrideQuery(
    fn: OverrideHttpRequestFn<Ctx, HttpRequestTemplate['query']>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'query', fn });

    return this;
  }

  overridePathParameters(
    fn: OverrideHttpRequestFn<Ctx, HttpRequestTemplate['pathParameters']>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'pathParameters', fn });

    return this;
  }

  overrideHeaders(
    fn: OverrideHttpRequestFn<Ctx, HttpRequestTemplate['headers']>
  ): this {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.test.override.push({ part: 'headers', fn });

    return this;
  }

  done(): SingleHttpTest {
    return this.test;
  }
}

export function test<Ctx extends HttpTestContext>(
  name: string,
  fn: (t: SingleHttpTestBuilder<Ctx, never, never>) => SingleHttpTest
): SingleHttpTest {
  return fn(new SingleHttpTestBuilder(name));
}
