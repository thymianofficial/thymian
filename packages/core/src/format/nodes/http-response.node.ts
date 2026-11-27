import type { HttpStatusCodeRange } from '../../http-status-codes/http-status-code-ranges.js';
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
   * response is not a test target (ADR-0027).
   */
  statusCode: number | 'default';
  /**
   * The status code range this node was built from, when the specification
   * documents its status only through a range (an OpenAPI `4XX` key): a
   * Range-Derived Response. Absent on a response documented under its own code
   * and on a `default` response, so its presence alone marks a node as
   * range-derived (ADR-0031).
   */
  derivedFromRange?: HttpStatusCodeRange;
  schema?: ThymianSchema;
}

/**
 * Whether a response node is the specification's `default` response rather
 * than one for a concrete status (ADR-0027).
 */
export function isDefaultResponse(
  response: Pick<ThymianHttpResponse, 'statusCode'>,
): boolean {
  return response.statusCode === 'default';
}

/**
 * Whether the specification documents a response node under its own status
 * code: neither a Range-Derived Response nor the `default` response. What the
 * `explicitlyDocumented()` filter answers against a response node (ADR-0031).
 */
export function isExplicitlyDocumented(
  response: Pick<ThymianHttpResponse, 'statusCode' | 'derivedFromRange'>,
): boolean {
  return (
    !isDefaultResponse(response) && response.derivedFromRange === undefined
  );
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
 * explicitly instead (ADR-0027).
 */
export function isTestableTransaction(
  transaction: ThymianHttpTransaction,
): transaction is TestableThymianHttpTransaction {
  return !isDefaultResponse(transaction.thymianRes);
}
