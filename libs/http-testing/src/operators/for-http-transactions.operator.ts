import {
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { from, mergeMap, type OperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { ThymianHttpTransaction } from '../http-test-case.js';
import { matchObjects, type StringAndNumberProperties } from '../utils.js';

export type RequestFilter =
  | StringAndNumberProperties<ThymianHttpRequest>
  | ((
      req: ThymianHttpRequest,
      reqId: string,
      responses: [string, ThymianHttpResponse][]
    ) => boolean);

export type ResponseFilter =
  | StringAndNumberProperties<ThymianHttpResponse>
  | ((
      res: ThymianHttpResponse,
      resId: string,
      req: ThymianHttpRequest,
      reqId: string
    ) => boolean);

export function forHttpTransactions(
  reqFilter: RequestFilter = {},
  resFilter: ResponseFilter = {}
): OperatorFunction<
  HttpTestInstance<ThymianFormat>,
  HttpTestInstance<ThymianHttpTransaction>
> {
  return mergeMap(({ ctx }) => {
    const { format } = ctx;

    const transactions = format
      .getHttpTransactions()
      .map<ThymianHttpTransaction>(
        ([thymianReqId, thymianResId, transactionId]) => {
          const thymianReq = format.getNode<ThymianHttpRequest>(thymianReqId);
          const thymianRes = format.getNode<ThymianHttpResponse>(thymianResId);

          if (!(thymianReq && thymianRes)) {
            throw new Error(
              `Invalid HTTP Transaction with id ${transactionId}.`
            );
          }

          return {
            thymianReqId,
            thymianResId,
            transactionId,
            thymianReq,
            thymianRes,
          };
        }
      )
      .filter(
        typeof reqFilter === 'function'
          ? (transaction) =>
              reqFilter(
                transaction.thymianReq,
                transaction.thymianReqId,
                ctx.format.getNeighboursOfType(
                  transaction.thymianReqId,
                  'http-response'
                )
              )
          : (transaction) => matchObjects(transaction.thymianReq, reqFilter)
      )
      .filter(
        typeof resFilter === 'function'
          ? (transaction) =>
              resFilter(
                transaction.thymianRes,
                transaction.thymianResId,
                transaction.thymianReq,
                transaction.thymianReqId
              )
          : (transaction) => matchObjects(transaction.thymianRes, resFilter)
      );

    return from(transactions.map((curr) => ({ ctx, curr })));
  });
}
