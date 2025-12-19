import type { ThymianHttpTransaction } from '@thymian/core';

export type HttpTestCaseResult = {
  message: string;
  timestamp?: number;
  location?: { stepIdx: number; transactionIdx: number };
} & (
  | AssertionSuccess
  | AssertionFailure
  | ExecutionError
  | Timeout
  | Skip
  | Warning
  | Info
  | InvalidTransaction
);

export type AssertionSuccess = {
  type: 'assertion-success';
  assertion?: string;
};

export type AssertionFailure = {
  type: 'assertion-failure';
  assertion?: string;
  expected?: unknown;
  actual?: unknown;
  transaction?: ThymianHttpTransaction;
};

export type ExecutionError = {
  type: 'execution-error';
  error: string;
};

export type Timeout = {
  type: 'timeout';
  durationMs: number;
};

export type Skip = {
  type: 'skip';
  reason?: string;
};

export type Warning = {
  type: 'warning';
  details?: string;
};

export type Info = {
  type: 'info';
  details?: string;
};

export type InvalidTransaction = {
  type: 'invalid-transaction';
  details?: string;
  transaction?: ThymianHttpTransaction;
};
