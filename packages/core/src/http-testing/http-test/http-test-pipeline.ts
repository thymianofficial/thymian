import type { Observable } from 'rxjs';

import type { ThymianHttpTransaction } from '../../index.js';
import type { HttpTestCase } from './http-test-case.js';
import type {
  HttpTestContext,
  HttpTestContextLocals,
} from './http-test-context.js';

export type PipelineItem<
  Current,
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> = {
  current: Current;
  ctx: HttpTestContext<Locals>;
};

export type HttpTestPipeline<Locals extends HttpTestContextLocals> = (
  transactions: Observable<PipelineItem<ThymianHttpTransaction, Locals>>,
) => Observable<PipelineItem<HttpTestCase, Locals>>;
