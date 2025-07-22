import {
  matchObjects,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
} from '@thymian/core';
import { filter, type MonoTypeOperatorFunction } from 'rxjs';

import type { PipelineItem } from '../http-test/index.js';
import { type StringAndNumberProperties } from '../utils.js';

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

export function filterHttpTransactions(
  reqFilter: RequestFilter = {},
  resFilter: ResponseFilter = {}
): MonoTypeOperatorFunction<PipelineItem<ThymianHttpTransaction>> {
  return filter(({ current: transaction, ctx }) => {
    const requestFilter =
      typeof reqFilter !== 'function'
        ? (t: ThymianHttpTransaction) => matchObjects(t.thymianReq, reqFilter)
        : (t: ThymianHttpTransaction) => {
            const responses = ctx.format.getNeighboursOfType(
              transaction.thymianReqId,
              'http-response'
            );

            return reqFilter(t.thymianReq, t.thymianReqId, responses);
          };

    const responseFilter =
      typeof resFilter !== 'function'
        ? (t: ThymianHttpTransaction) => matchObjects(t.thymianRes, resFilter)
        : (t: ThymianHttpTransaction) =>
            resFilter(
              t.thymianRes,
              t.thymianResId,
              t.thymianReq,
              t.thymianReqId
            );

    return requestFilter(transaction) && responseFilter(transaction);
  });
}
