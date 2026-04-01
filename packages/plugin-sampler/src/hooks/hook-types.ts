import type { HttpTestHooks } from '@thymian/core';

import type { Endpoints, HookUtils } from './hook-utils.js';

export type SampleHttpTestHook<
  Hook extends keyof HttpTestHooks,
  E extends Endpoints,
> = (
  value: HttpTestHooks[Hook]['arg']['value'],
  ctx: HttpTestHooks[Hook]['arg']['ctx'],
  utils: HookUtils<E>,
) => Promise<HttpTestHooks[Hook]['return']['result']>;

export type BeforeEachRequestHook<E extends Endpoints = Record<string, any>> =
  SampleHttpTestHook<'beforeRequest', E>;
export type AfterEachResponseHook<E extends Endpoints = Record<string, any>> =
  SampleHttpTestHook<'afterResponse', E>;
export type AuthorizeHook<E extends Endpoints = Record<string, any>> =
  SampleHttpTestHook<'authorize', E>;
