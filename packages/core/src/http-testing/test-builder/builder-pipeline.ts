import type { OperatorFunction } from 'rxjs';

import type { PipelineItem } from '../http-test/index.js';

export type BuilderPipeline = OperatorFunction<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PipelineItem<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PipelineItem<any>
>[];
