import {
  Thymian,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';

export class SequenceTestBuilder<Context extends Record<PropertyKey, unknown>> {
  private readonly steps: HttpTestPipeline[] = [];

  step(
    name: string,
    fn: (pipeline: HttpTestPipeline<ThymianFormat, Context>) => HttpTestPipeline
  ): SequenceTestBuilder<Context>;
  step(
    fn: (pipeline: HttpTestPipeline<ThymianFormat, Context>) => HttpTestPipeline
  ): SequenceTestBuilder<Context>;
  step(
    nameOrFn:
      | ((
          pipeline: HttpTestPipeline<ThymianFormat, Context>
        ) => HttpTestPipeline)
      | string,
    fn?: (
      pipeline: HttpTestPipeline<ThymianFormat, Context>
    ) => HttpTestPipeline
  ): SequenceTestBuilder<Context> {
    if (typeof nameOrFn === 'string') {
      this.steps.push(fn!(new HttpTestPipeline()));
    } else {
      this.steps.push(nameOrFn(new HttpTestPipeline()));
    }

    return this as unknown as SequenceTestBuilder<
      Context & { prev: ThymianHttpTransaction }
    >;
  }
}

export type Operator<
  Input = any,
  Output = any,
  InContext extends Record<PropertyKey, unknown> = any,
  OutContext extends Record<PropertyKey, unknown> = InContext
> = (
  input: Input,
  ctx: InContext & PipelineContext
) => [Output, OutContext] | Promise<[Output, OutContext]>;

type Merge<
  Context extends PipelineContext,
  NewContext extends Record<PropertyKey, unknown>
> = Context & NewContext;

export interface PipelineContext {
  fail(msg?: string): void;
  skip(msg?: string): void;
  pass(msg?: string): void;
  [key: PropertyKey]: unknown;
}

export async function processPipeline(
  pipeline: SingleHttpTestPipeline<any, any>
): Promise<unknown> {
  let output = pipeline.initial;
  let context: PipelineContext = {
    fail(msg?: string): void {},
    pass(msg?: string): void {},
    skip(msg?: string): void {},
  };

  for (const op of pipeline.pipeline) {
    let newContext;
    [output, newContext] = await op(output, context);

    context = {
      ...context,
      ...newContext,
    };
  }

  return output;
}

export interface TestContext {
  fail(msg?: string): void;
  skip(msg?: string): void;
  pass(msg?: string): void;
  [key: PropertyKey]: unknown;
}

export interface HttpTestResult {
  status: 'skipped' | 'failed' | 'passed';
  cases: string[];
}

export class HttpTestPipeline<
  Value = ThymianFormat,
  const Context extends Record<PropertyKey, unknown> = Record<
    PropertyKey,
    unknown
  >
> {
  readonly operators: Operator[];

  constructor(operators: Operator[] = []) {
    this.operators = operators;
  }

  pipe<A, B extends Context>(
    op1: Operator<Value, A, Context, B>
  ): HttpTestPipeline<A, B>;
  pipe<
    A,
    B extends Record<PropertyKey, unknown>,
    C,
    D extends Record<PropertyKey, unknown>
  >(
    op1: Operator<Value, A, Context, B>,
    op2: Operator<A, C, B, D>
  ): HttpTestPipeline<C, D>;
  pipe<
    A,
    B extends Context,
    C,
    D extends Record<PropertyKey, unknown>,
    E,
    F extends Record<PropertyKey, unknown>
  >(
    op1: Operator<Value, A, Context, B>,
    op2: Operator<A, C, B, D>,
    op3: Operator<C, E, D, F>
  ): HttpTestPipeline<E, F>;
  pipe<
    A,
    B extends Context,
    C,
    D extends Record<PropertyKey, unknown>,
    E,
    F extends Record<PropertyKey, unknown>,
    G,
    H extends Record<PropertyKey, unknown>
  >(
    op1: Operator<Value, A, Context, B>,
    op2: Operator<A, C, B, D>,
    op3: Operator<C, E, D, F>,
    op4: Operator<E, G, F, H>
  ): HttpTestPipeline<G, H>;
  pipe(...operators: Operator[]): HttpTestPipeline<any, any> {
    this.operators.push(...operators);

    return this;
  }

  async process(
    format: ThymianFormat,
    context: Record<PropertyKey, unknown>
  ): Promise<HttpTestResult> {
    let ctx = context;
    let output = format;

    let failed = false;
    let skipped = false;
    let passed = false;

    const testContext: TestContext = {
      fail(msg: string | undefined): void {
        failed = true;
      },
      format,
      pass(): void {
        passed = true;
      },
      skip(): void {
        skipped = true;
      },
    };

    for (const op of this.operators) {
      try {
        [output, ctx] = await op(output, { ...ctx, ...testContext });
      } catch (e) {
        return {
          status: 'failed',
          cases: [],
        };
      }

      if (failed) {
        return {
          status: 'failed',
          cases: [],
        };
      }

      if (skipped) {
        return {
          status: 'skipped',
          cases: [],
        };
      }

      if (passed) {
        return {
          status: 'passed',
          cases: [],
        };
      }
    }

    return {
      status: 'passed',
      cases: [],
    };
  }
}

export class SingleHttpTestPipeline<Input, Context extends PipelineContext> {
  readonly pipeline: Operator<any, any, any, any>[] = [];

  constructor(readonly initial: Input, context: Context) {}

  pipeInCool<
    A,
    const B extends Record<PropertyKey, unknown>,
    C,
    const D extends Record<PropertyKey, unknown>,
    E,
    const F extends Record<PropertyKey, unknown>
  >(
    op1: Operator<Input, A, Context, B>,
    op2: Operator<A, C, Merge<Context, B>, D>,
    op3: Operator<C, E, Merge<Context, D>, F>
  ): SingleHttpTestPipeline<E, Merge<Context, F>> {
    this.pipeline.push(op1, op2, op3);

    return this as unknown as SingleHttpTestPipeline<E, Merge<Context, F>>;
  }

  pipe<Out, OutContext extends Record<PropertyKey, unknown>>(
    operator: Operator<Input, Out, Context, OutContext>
  ): SingleHttpTestPipeline<Out, Merge<Context, OutContext>> {
    this.pipeline.push(operator);

    return this as unknown as SingleHttpTestPipeline<
      Out,
      Merge<Context, OutContext>
    >;
  }

  map<Out>(
    fn: (input: Input, ctx: Context) => Out | Promise<Out>
  ): SingleHttpTestPipeline<Out, Context> {
    return this.pipe<Out, Context>(async (input, ctx) => {
      return [await fn(input, ctx), ctx];
    });
  }
}

export type ThymianHttpTransaction = {
  req: ThymianHttpRequest;
  reqId: string;
  res: ThymianHttpResponse;
  resId: string;
};

const httpTransactions: Operator<ThymianFormat, ThymianHttpTransaction[]> = (
  format,
  ctx
) => {
  return [
    format.getHttpTransactions().map(([reqId, resId]) => {
      return {
        reqId,
        resId,
        req: format.getNode<ThymianHttpRequest>(reqId),
        res: format.getNode<ThymianHttpResponse>(resId),
      };
    }),
    ctx,
  ];
};

function filter(
  predicate: (transaction: ThymianHttpTransaction) => boolean
): Operator<ThymianHttpTransaction[], ThymianHttpTransaction[]> {
  return (transactions, ctx) => [transactions.filter(predicate), ctx];
}

function withContext<
  const OutContext extends Record<PropertyKey, unknown>,
  InContext extends PipelineContext,
  Input
>(
  fn: (ctx: InContext) => OutContext
): Operator<Input, Input, InContext, OutContext> {
  return (input: Input, ctx: InContext) => [input, fn(ctx)];
}

const pipeline = new SingleHttpTestPipeline(new ThymianFormat(), {
  fail(msg?: string): void {},
  pass(msg?: string): void {},
  skip(msg?: string): void {},
})
  .map((format) =>
    format.getHttpTransactions().map(([reqId, resId]) => {
      return {
        reqId,
        resId,
        req: format.getNode<ThymianHttpRequest>(reqId),
        res: format.getNode<ThymianHttpResponse>(resId),
      };
    })
  )
  .pipe(
    filter(
      (transaction) =>
        transaction.req.method === 'POST' && transaction.res.statusCode === 201
    )
  )
  .pipe(withContext(() => ({ test: '12' })))
  .pipe(withContext((ctx) => ({ test: ctx.test + '3' })))
  .pipe((x, y) => [x, y]);
