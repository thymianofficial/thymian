import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTransaction } from '../http-test-case.js';
import type { HttpTestContext } from '../http-test-context.js';
import { BaseRequestGenerator } from './base-request-generator.js';
import { RangeRequestGenerator } from './range-request-generator.js';
import type { RequestGenerator } from './request-generator.js';

export function generateRequest(
  transaction: ThymianHttpTransaction,
  ctx: HttpTestContext
): Promise<HttpRequestTemplate> {
  const strategies: RequestGenerator[] = [
    new RangeRequestGenerator(transaction, ctx),
  ];

  const strategy =
    strategies.find((s) => s.matches()) ??
    new BaseRequestGenerator(transaction, ctx);

  return strategy.generate();
}
