import type { SecurityScheme } from '@thymian/core';
import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseTransaction,
} from '../http-test-case.js';
import { isRecord } from '../utils.js';

export function hasThymianReqId(
  value: unknown
): value is Record<PropertyKey, unknown> & { thymianRedId: string } {
  return isRecord(value) && 'thymianReqId' in value;
}

export async function authorizeTransaction(
  transactions: HttpTestCaseTransaction[],
  fn: (transaction: HttpTestCaseTransaction) => Promise<HttpTestCaseTransaction>
): Promise<HttpTestCaseTransaction[]> {
  for await (const [idx, transaction] of transactions.entries()) {
    transactions[idx] = await fn(transaction);
  }

  return transactions;
}

export function authorizeRequests<
  Steps extends HttpTestCaseStep[]
>(): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    const step = curr.steps.at(-1);

    if (!step) {
      return { curr, ctx };
    }

    let fn = (transaction: HttpTestCaseTransaction) =>
      ctx.runHook('authorize', transaction);

    if (hasThymianReqId(step.source)) {
      const schemeNodeId = ctx.format.graph.findOutNeighbor(
        step.source.thymianReqId,
        (id, node) => node.type === 'security-scheme'
      );

      if (schemeNodeId) {
        const securityScheme =
          // we know that the node with this id exists
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ctx.format.getNode<SecurityScheme>(schemeNodeId)!;

        // extend the if statement to support more security schemes
        if (securityScheme.scheme === 'basic' && ctx.auth?.basic) {
          fn = async (transaction) => {
            transaction.request.headers['Authorization'] = `Basic ${Buffer.from(
              // basic auth is defined
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              (await ctx.auth.basic(transaction)).join(':')
            ).toString('base64')}`;

            return transaction;
          };
        }
      }
    }

    step.transactions = await authorizeTransaction(step.transactions, fn);

    return { curr, ctx };
  });
}
