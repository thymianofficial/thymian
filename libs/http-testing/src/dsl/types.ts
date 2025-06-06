import type { HttpTestContext } from '../http-test/context.js';

export type ExtendContext<
  Ctx extends HttpTestContext,
  Context extends HttpTestContext | ((ctx: Ctx) => unknown)
> = Ctx &
  (Context extends (ctx: Ctx) => unknown
    ? Awaited<ReturnType<Context>>
    : Context);

export type AssertionOptions = {
  body: boolean;
  headers: boolean;
  statusCode: boolean;
};
