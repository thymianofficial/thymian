import {
  httpRequestToLabel,
  httpResponseToLabel,
  httpTransactionToLabel,
} from '@thymian/core';

import type { CapturedTrace, CapturedTransaction } from '../../types.js';

export function capturedTraceToString(trace: CapturedTrace): string {
  const firstTransactions = trace[0];
  // the check prevents that lastTransaction is equal to firstTransaction
  const lastTransactions =
    trace[trace.length - 1] === trace[0] ? undefined : trace[trace.length - 1];

  // length === 1
  if (!lastTransactions && !!firstTransactions) {
    return httpTransactionToLabel(
      firstTransactions.request.data,
      firstTransactions.response.data,
    );
  }

  // we changed this with the first checked so that we can be sure that firstTransactions and lastTransactions are not undefined, because if one of them is undefined, the other one is also undefined, so we can check only one of them
  // length === 0
  if (!firstTransactions || !lastTransactions) {
    return '';
  }

  const formatReq = (t: CapturedTransaction) =>
    httpRequestToLabel(t.request.data);
  const formatRes = (t: CapturedTransaction) =>
    httpResponseToLabel(t.response.data);

  if (trace.length === 2) {
    const requests = trace.map(formatReq);
    const responses = trace.map(formatRes).reverse();
    return [...requests, ...responses].join(' -> ');
  }

  const firstReq = formatReq(firstTransactions);
  const lastReq = formatReq(lastTransactions);
  const lastRes = formatRes(lastTransactions);
  const firstRes = formatRes(firstTransactions);
  return `${firstReq} -> ${lastReq} ->  ...${trace.length - 2}x more  -> ${lastRes} -> ${firstRes}`;
}
