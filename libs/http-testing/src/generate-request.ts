import type { ThymianHttpTransaction } from '@thymian/core';

import type { HttpRequestTemplate } from './http-request-template.js';
import type {
  GenerateRequestsOptions,
  HttpTestContext,
} from './http-test/index.js';
import {
  BaseRequestGenerator,
  RangeRequestGenerator,
  type RequestGenerator,
  UnauthorizedRequestGenerator,
} from './request-generator/index.js';

export function generateRequest(
  transaction: ThymianHttpTransaction,
  ctx: HttpTestContext,
  options?: GenerateRequestsOptions
): Promise<HttpRequestTemplate> {
  const strategies: RequestGenerator[] = [
    new RangeRequestGenerator(transaction, ctx, options),
    new UnauthorizedRequestGenerator(transaction, ctx, options),
  ];

  const strategy =
    strategies.find((s) => s.matches()) ??
    new BaseRequestGenerator(transaction, ctx, options);

  return strategy.generate();
}
