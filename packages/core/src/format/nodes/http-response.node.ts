import type { Parameter } from '../parameter.js';
import type { ThymianHttpTransaction } from '../thymian-format.js';
import type { ThymianSchema } from '../thymian-schema.js';
import type { ThymianBaseNode } from './node.js';

export interface ThymianHttpResponse extends ThymianBaseNode {
  type: 'http-response';
  description?: string;
  headers: Record<string, Parameter>;
  mediaType: string;
  /**
   * The documented status, or `'default'` for a response the specification
   * declares as its default (an OpenAPI `default` Response Object). A `default`
   * response is not a test target (ADR-0026).
   */
  statusCode: number | 'default';
  schema?: ThymianSchema;
}

/**
 * Whether a response node is the specification's `default` response rather
 * than one for a concrete status (ADR-0026).
 */
export function isDefaultResponse(
  response: Pick<ThymianHttpResponse, 'statusCode'>,
): boolean {
  return response.statusCode === 'default';
}

/**
 * A Transaction that can be a test target: its response names a concrete
 * status. What {@link isTestableTransaction} narrows to.
 */
export type TestableThymianHttpTransaction = ThymianHttpTransaction & {
  thymianRes: ThymianHttpResponse & { statusCode: number };
};

/**
 * Whether a Transaction can be a test target: it names a concrete status a
 * request could be aimed at.
 *
 * `ThymianFormat.getThymianHttpTransactions()` stays complete, because `lint`
 * and `analyze` must see `default` Transactions. Every test-side caller —
 * `test` case generation, sampling, hooks, the type surface — filters with this
 * explicitly instead (ADR-0026).
 */
export function isTestableTransaction(
  transaction: ThymianHttpTransaction,
): transaction is TestableThymianHttpTransaction {
  return !isDefaultResponse(transaction.thymianRes);
}
