import type { HttpTransaction } from './types.js';
import { all } from 'deepmerge';

export function deepMergeHttpTransaction(
  ...transactions: HttpTransaction[]
): HttpTransaction {
  return all<HttpTransaction>(transactions);
}
