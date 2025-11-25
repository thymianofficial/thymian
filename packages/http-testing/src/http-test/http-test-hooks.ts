import type { HttpRequestTemplate, HttpResponse } from '@thymian/core';

import type { HttpTestCaseResult } from './http-test-case-result.js';

export type HttpTestHookArg<T, Context = never> = {
  value: T;
  context?: Context;
};

export type HttpTestHookReturnType<T> = {
  value: T;
  testResults?: HttpTestCaseResult[];
  skip?: string;
  fail?: string;
};

export type HttpTestHook<T, Context = never> = {
  arg: HttpTestHookArg<T, Context>;
  return: HttpTestHookReturnType<T>;
};

export interface HttpTestHooks {
  beforeRequest: HttpTestHook<HttpRequestTemplate>;

  afterResponse: HttpTestHook<HttpResponse>;

  authorize: {
    arg: {
      value: HttpRequestTemplate;
    };
    return: {
      value: HttpRequestTemplate;
    };
  };
}
