import type { HttpRequest } from '../request.js';
import type { HttpTestContext } from './context.js';

export type Override = {
  overrideQuery: OverrideQuery[];
  overrideHeader: OverrideHeader[];
  overrideBody: OverrideBody[];
  overridePath: OverridePath[];
};

export type OverrideHttpRequest<
  Ctx extends HttpTestContext = HttpTestContext,
  Part extends keyof HttpRequest = keyof HttpRequest
> = {
  part: Part;
  fn: OverrideHttpRequestFn<Ctx, HttpRequest[Part]>;
};

export type OverrideHttpRequestFn<
  Ctx extends HttpTestContext,
  T extends HttpRequest[keyof HttpRequest]
> = (original: T, ctx: Ctx) => T | undefined;

export type OverrideFn<
  T,
  Ctx extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = (original: T | undefined, ctx: Ctx) => T | undefined;

export type OverrideQuery<
  Ctx extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  name: string;
  fn: OverrideFn<string, Ctx>;
};

export type OverrideHeader<
  Ctx extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  name: string;
  fn: OverrideFn<string | string[], Ctx>;
};

export type OverrideBody<
  Ctx extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  fn: (original: unknown, ctx: Ctx) => unknown;
};

export type OverridePath<
  Ctx extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  name: string;
  fn: OverrideFn<string, Ctx>;
};
