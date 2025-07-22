import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTransaction } from '../http-test-case.js';
import type {
  GenerateRequestsOptions,
  HttpTestContext,
} from '../http-test-context.js';
import { BaseRequestGenerator } from './base-request-generator.js';
import { RangeRequestGenerator } from './range-request-generator.js';
import type { RequestGenerator } from './request-generator.js';
import { UnauthorizedRequestGenerator } from './unauthorized-request-generator.js';

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
