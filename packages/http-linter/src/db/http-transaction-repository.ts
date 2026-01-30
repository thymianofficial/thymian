import type { HttpFilterExpression } from '@thymian/core';

import type { HttpParticipantRole } from '../rule/rule-meta.js';
import type { CapturedTrace, CapturedTransaction } from '../types.js';

export type Awaitable<T> = T | Promise<T>;

export interface HttpTransactionRepository {
  init(): Awaitable<void>;

  close(): Awaitable<void>;

  insertHttpTrace(trace: CapturedTrace): Awaitable<number>;

  readTraceById(id: number): Awaitable<CapturedTrace | undefined>;

  insertHttpTransaction(transaction: CapturedTransaction): Awaitable<number>;

  readTransactionById(id: number): Awaitable<CapturedTransaction | undefined>;

  readTransactionsByHttpFilter(
    filter: HttpFilterExpression,
    role?: HttpParticipantRole[],
  ): IterableIterator<CapturedTransaction, void, unknown>;

  readAndGroupTransactionsByHttpFilter(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    role?: HttpParticipantRole[],
  ): IterableIterator<[string, CapturedTransaction[]], void, unknown>;
}
