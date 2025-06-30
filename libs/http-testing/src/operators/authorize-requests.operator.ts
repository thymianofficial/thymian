import type { SecurityScheme } from '@thymian/core';
import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  type HttpTestCaseTransaction,
  isFailedTestCase,
  isSkippedTestCase,
} from '../http-test-case.js';
import type { HttpTestContext } from '../http-test-context.js';
import { hasThymianReqId } from './utils.js';

export function extractAuthorizationScheme(
  source: unknown,
  ctx: HttpTestContext,
  validAuth: boolean
):
  | ((transaction: HttpTestCaseTransaction) => Promise<HttpTestCaseTransaction>)
  | undefined {
  if (hasThymianReqId(source)) {
    const schemeNodeId = ctx.format.graph.findOutNeighbor(
      source.thymianReqId,
      (id, node) => node.type === 'security-scheme'
    );

    if (schemeNodeId) {
      const securityScheme =
        // we know that the node with this id exists
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ctx.format.getNode<SecurityScheme>(schemeNodeId)!;

      // extend the if statement to support more security schemes
      if (securityScheme.scheme === 'basic' && ctx.auth?.basic) {
        return async (transaction) => {
          transaction.requestTemplate.headers[
            'Authorization'
          ] = `Basic ${Buffer.from(
            (validAuth
              ? // basic auth is defined
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                await ctx.auth.basic(transaction)
              : ['admin', 'admin']
            ) // How should we get invalid credentials?
              .join(':')
          ).toString('base64')}`;

          return transaction;
        };
      }
    }
  }

  return undefined;
}

export function authorizeRequests<Steps extends HttpTestCaseStep[]>(
  validAuth = true
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    if (isSkippedTestCase(curr) || isFailedTestCase(curr)) {
      return { curr, ctx };
    }

    const step = curr.steps.at(-1);

    if (!step) {
      return { curr, ctx };
    }

    const fn =
      extractAuthorizationScheme(step.source, ctx, validAuth) ??
      (async (transaction: HttpTestCaseTransaction) =>
        ctx.runHook('authorize', transaction));

    step.transactions = await Promise.all(
      step.transactions.map((transaction) => {
        const authorize =
          extractAuthorizationScheme(transaction.source, ctx, validAuth) ?? fn;

        return authorize(transaction);
      })
    );

    return { curr, ctx };
  });
}
