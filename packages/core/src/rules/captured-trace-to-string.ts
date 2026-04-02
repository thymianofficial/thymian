import {
  httpRequestToLabel,
  httpResponseToLabel,
  httpTransactionToLabel,
} from '../utils.js';
import type { CapturedTrace, CapturedTransaction } from './traffic.js';

export function capturedTraceToString(trace: CapturedTrace): string {
  const firstTransaction = trace[0];
  // This check prevents lastTransaction from being equal to firstTransaction when the array has only one element.
  const lastTransaction =
    trace[trace.length - 1] === trace[0] ? undefined : trace[trace.length - 1];

  // length === 1
  if (!lastTransaction && !!firstTransaction) {
    return httpTransactionToLabel(
      firstTransaction.request.data,
      firstTransaction.response.data,
    );
  }

  // Handle empty trace case.
  if (!firstTransaction || !lastTransaction) {
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

  const firstReq = formatReq(firstTransaction);
  const lastReq = formatReq(lastTransaction);
  const lastRes = formatRes(lastTransaction);
  const firstRes = formatRes(firstTransaction);
  return `${firstReq} -> ${lastReq} -> ...${trace.length - 2}x more -> ${lastRes} -> ${firstRes}`;
}
