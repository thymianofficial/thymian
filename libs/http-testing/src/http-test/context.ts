import { ThymianFormat } from '@thymian/core';

export type HttpTestContext = Record<PropertyKey, unknown> & {
  format: ThymianFormat;
  skip: () => never;
  fail: (msg?: string) => never;
  pass: () => never;
};

export type HttpTestContextFn<Ctx extends HttpTestContext = HttpTestContext> = (
  ctx: Ctx
) => Record<PropertyKey, unknown>;
