import { filter, type MonoTypeOperatorFunction } from 'rxjs';

import type { ThymianHttpTransaction, ThymianNode } from '../../index.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function requiresAuthorization(
  requireAuthorization = true,
): MonoTypeOperatorFunction<PipelineItem<ThymianHttpTransaction>> {
  return filter(({ current, ctx }) => {
    return (
      requireAuthorization ===
      (typeof ctx.format.graph.findOutNeighbor(
        current.thymianReqId,
        (_id: string, node: ThymianNode) => node.type === 'security-scheme',
      ) ===
        'string')
    );
  });
}
