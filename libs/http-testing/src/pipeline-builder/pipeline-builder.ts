import type { OperatorFunction } from 'rxjs';

import type { PipelineItem } from '../http-test/index.js';

export type Pipeline = OperatorFunction<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PipelineItem<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PipelineItem<any>
>[];

export abstract class PipelineBuilder {
  constructor(protected readonly pipeline: Pipeline = []) {}

  getPipeline(): Pipeline {
    return this.pipeline;
  }
}
