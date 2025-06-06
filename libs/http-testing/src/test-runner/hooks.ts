import type { ThymianHttpResponse } from '@thymian/core';

import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';

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
    request: HttpRequestTemplate;
    requestId: string;
    expectedResponseId: string;
    expectedResponse?: ThymianHttpResponse;
  };
}

function hook<T extends keyof HttpTestHooks>(
  h: T,
  fn: (x: HttpTestHooks[T]) => HttpTestHooks[T]
) {}
