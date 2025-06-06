import type { AssertionFn } from '../assertions/assertion.js';
import type { HttpTestContext } from '../http-test/context.js';
import type {
  HttpTestTransaction,
  SequenceHttpTest,
  SingleHttpTest,
} from '../http-test/http-test.js';
import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';
import type { HttpResponse } from '../rxjs/http-response.js';
import { SingleHttpTestBuilder } from './single-http-test-builder.js';

export class SequenceHttpTestBuilder<Ctx extends HttpTestContext> {
  private readonly test: SequenceHttpTest;

  constructor(name: string) {
    this.test = {
      assertions: [],
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
    const Context extends Record<PropertyKey, unknown> | ((ctx: Ctx) => unknown)
  >(
    context: Context
  ): SequenceHttpTestBuilder<
    Ctx &
      (Context extends (ctx: Ctx) => unknown
        ? Awaited<ReturnType<Context>>
        : Context)
  > {
    if (typeof context === 'function') {
      // TODO
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.test.contextFns.push(context);
    } else {
      this.test.contextFns.push(() => context);
    }

    return this as unknown as SequenceHttpTestBuilder<
      Ctx &
        (Context extends (ctx: Ctx) => unknown
          ? Awaited<ReturnType<Context>>
          : Context)
    >;
  }

  expect(
    fn: AssertionFn<{
      transactions: { req: HttpRequestTemplate; res: HttpResponse };
      ctx: Ctx;
    }>
  ): this {
    this.test.assertions.push(fn);

    return this;
  }

  done(): SequenceHttpTest {
    return this.test;
  }
}

export function sequence<Ctx extends HttpTestContext>(
  name: string,
  fn: (t: SequenceHttpTestBuilder<Ctx>) => SequenceHttpTest
): SequenceHttpTest {
  return fn(new SequenceHttpTestBuilder(name));
}
