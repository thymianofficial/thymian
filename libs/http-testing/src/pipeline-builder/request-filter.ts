import {
  equalsIgnoreCase,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
} from '@thymian/core';
import { filter, type OperatorFunction } from 'rxjs';

import type { PipelineItem } from '../http-test/index.js';
import { filterHttpTransactions } from '../operators/index.js';
import { PipelineBuilder } from './pipeline-builder.js';

export class RequestFilter extends PipelineBuilder {
  withMethod(...method: string[]): RequestFilter {
    const operatorFunction: OperatorFunction<
      PipelineItem<ThymianHttpTransaction>,
      PipelineItem<ThymianHttpTransaction>
    > = filter(({ current }) =>
      equalsIgnoreCase(current.thymianReq.method, ...method)
    );

    this.pipeline.push(operatorFunction);

    return this;
  }

  withHeader(header: string): RequestFilter {
    const operatorFunction: OperatorFunction<
      PipelineItem<ThymianHttpTransaction>,
      PipelineItem<ThymianHttpTransaction>
    > = filter(({ current }) =>
      equalsIgnoreCase(header, ...Object.keys(current.thymianReq.headers))
    );

    this.pipeline.push(operatorFunction);

    return this;
  }

  with(
    fn: (
      req: ThymianHttpRequest,
      reqId: string,
      responses: [string, ThymianHttpResponse][]
    ) => boolean
  ): RequestFilter {
    this.pipeline.push(filterHttpTransactions(fn));

    return this;
  }
}
