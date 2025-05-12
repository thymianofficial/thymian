import type {
  ThymianFormat,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';

export type TransactionsFilterFn = (
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
  args: {
    reqId: string;
    resId: string;
    format: ThymianFormat;
  }
) => boolean;
