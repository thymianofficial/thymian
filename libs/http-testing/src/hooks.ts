import type { HttpRequest } from './request.js';
import type { ThymianHttpResponse } from '@thymian/core';

export type HttpTestHook = {
  id: string;
  name: string;
  description?: string;
  context: Record<string, unknown>;
  start: number;
  end?: number;
};

export interface HttpTestHooks {
  beforeEachRequest: {
    request: HttpRequest;
    requestId: string;
    expectedResponseId: string;
    expectedResponse?: ThymianHttpResponse;
  };
}

function hook<T extends keyof HttpTestHooks>(
  h: T,
  fn: (x: HttpTestHooks[T]) => HttpTestHooks[T]
) {}
