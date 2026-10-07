import type { HttpFilterExpression } from '@thymian/core';
import type {
  CapturedTrace,
  CapturedTransaction,
  HttpParticipantRole,
  HttpRequest,
  HttpResponse,
} from '@thymian/core';

export type Awaitable<T> = T | Promise<T>;

export interface HttpTransactionRepository {
  init(): Awaitable<void>;

  /**
   * How `authorization()` is answered for a recorded pair: whether the
   * specification secures the request it was matched to.
   */
  answerIsSecuredWith(
    isSecured: (request: HttpRequest, response: HttpResponse) => boolean,
  ): void;

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

  readAllHttpTraces(): IterableIterator<CapturedTrace, void, unknown>;
}
