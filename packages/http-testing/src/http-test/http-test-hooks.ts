import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';

import type { HttpTestCaseResult } from './http-test-case-result.js';

export type HttpTestHookReturnType<T> = {
  result: T;
  testResults?: HttpTestCaseResult[];
  skip?: string;
  fail?: string;
};

export type HttpTestHookArg<T, Ctx> = {
  value: T;
  ctx: Ctx;
};

export type HttpTestHook<T, Ctx> = {
  arg: HttpTestHookArg<T, Ctx>;
  return: HttpTestHookReturnType<T>;
};

export interface HttpTestHooks {
  beforeRequest: HttpTestHook<
    HttpRequestTemplate,
    ThymianHttpTransaction | undefined
  >;

  afterResponse: HttpTestHook<
    HttpResponse,
    {
      requestTemplate: HttpRequestTemplate;
      request: HttpRequest;
      thymianTransaction?: ThymianHttpTransaction;
    }
  >;

  authorize: HttpTestHook<
    HttpRequestTemplate,
    ThymianHttpTransaction | undefined
  >;
}
