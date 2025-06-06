import type {
  ThymianFormat,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';

import type { HttpTestContext } from './context.js';

export type TransactionsFilterFn<
  Ctx extends HttpTestContext = HttpTestContext
> = (args: {
  req: ThymianHttpRequest;
  res: ThymianHttpResponse;
  reqId: string;
  resId: string;
  format: ThymianFormat;
  ctx: Ctx;
}) => boolean;
