import type { HttpTestContext } from '../http-test/context.js';
import type {
  HttpTestSuite,
  SequenceHttpTest,
  SingleHttpTest,
} from '../http-test/http-test.js';
import { SingleHttpTestBuilder } from './single-http-test-builder.js';
import { SequenceHttpTestBuilder } from './sequence-http-test-builder.js';

export class HttpTestSuiteBuilder<
  Ctx extends HttpTestContext = HttpTestContext
> {
  private readonly suite: HttpTestSuite;

  constructor(name: string) {
    this.suite = {
      name,
      tests: [],
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
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
