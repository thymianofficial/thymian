import {
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { from, mergeMap, type OperatorFunction } from 'rxjs';

import { matchObjects, type StringAndNumberProperties } from '../../utils.js';
import type { HttpTest } from '../http-test.js';
import type { ThymianHttpTestTransaction } from '../http-test-case.js';

export function forHttpTransactions(
  reqFilter:
    | StringAndNumberProperties<ThymianHttpRequest>
    | ((req: ThymianHttpRequest) => boolean) = {},
  resFilter:
    | StringAndNumberProperties<ThymianHttpResponse>
    | ((res: ThymianHttpResponse) => boolean) = {}
): OperatorFunction<
  HttpTest<ThymianFormat>,
  HttpTest<ThymianHttpTestTransaction>
> {
  return mergeMap(({ ctx }) => {
    const { format } = ctx;

    const transactions = format
      .getHttpTransactions()
      .map<ThymianHttpTestTransaction>(
        ([thymianReqId, thymianResId, transactionId]) => ({
          thymianReqId,
          thymianResId,
          transactionId,
          thymianReq: format.getNode<ThymianHttpRequest>(thymianReqId),
          thymianRes: format.getNode<ThymianHttpResponse>(thymianResId),
        })
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
