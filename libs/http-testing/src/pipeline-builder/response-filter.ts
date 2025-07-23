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

export class ResponseFilter extends PipelineBuilder {
  withStatusCode(statusCode: number): ResponseFilter {
    const operatorFunction: OperatorFunction<
      PipelineItem<ThymianHttpTransaction>,
      PipelineItem<ThymianHttpTransaction>
    > = filter(({ current }) => current.thymianRes.statusCode === statusCode);

    this.pipeline.push(operatorFunction);

    return this;
  }
  withHeader(header: string): ResponseFilter {
    const operatorFunction: OperatorFunction<
      PipelineItem<ThymianHttpTransaction>,
      PipelineItem<ThymianHttpTransaction>
    > = filter(({ current }) =>
      equalsIgnoreCase(header, ...Object.keys(current.thymianRes.headers))
    );

    this.pipeline.push(operatorFunction);

    return this;
  }

  with(
    fn: (
      res: ThymianHttpResponse,
      resId: string,
      req: ThymianHttpRequest,
      reqId: string
    ) => boolean
  ): ResponseFilter {
    this.pipeline.push(filterHttpTransactions({}, fn));
    return this;
  }
}
