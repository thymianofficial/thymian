import {
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { from, mergeMap, type OperatorFunction } from 'rxjs';

import { matchObjects, type StringAndNumberProperties } from '../utils.js';
import type { HttpTestInstance } from '../http-test.js';
import type { ThymianHttpTestTransaction } from '../http-test-case.js';

export type RequestFilter =
  | StringAndNumberProperties<ThymianHttpRequest>
  | ((req: ThymianHttpRequest) => boolean);

export type ResponseFilter =
  | StringAndNumberProperties<ThymianHttpResponse>
  | ((res: ThymianHttpResponse) => boolean);

export function forHttpTransactions(
  reqFilter: RequestFilter = {},
  resFilter: ResponseFilter = {}
): OperatorFunction<
  HttpTestInstance<ThymianFormat>,
  HttpTestInstance<ThymianHttpTestTransaction>
> {
  return mergeMap(({ ctx }) => {
    const { format } = ctx;

    const transactions = format
      .getHttpTransactions()
      .map<ThymianHttpTestTransaction>(
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
          ? (transaction) => reqFilter(transaction.thymianReq)
          : (transaction) => matchObjects(transaction.thymianReq, reqFilter)
      )
      .filter(
        typeof resFilter === 'function'
          ? (transaction) => resFilter(transaction.thymianRes)
          : (transaction) => matchObjects(transaction.thymianRes, resFilter)
      );

    return from(transactions.map((curr) => ({ ctx, curr })));
  });
}
