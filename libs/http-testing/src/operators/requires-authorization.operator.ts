import type { ThymianHttpTransaction } from '@thymian/core';
import { filter, type MonoTypeOperatorFunction } from 'rxjs';

import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function requiresAuthorization(
  requireAuthorization = true,
): MonoTypeOperatorFunction<PipelineItem<ThymianHttpTransaction>> {
  return filter(({ current, ctx }) => {
    return (
      requireAuthorization ===
      (typeof ctx.format.graph.findOutNeighbor(
        current.thymianReqId,
        (id, node) => node.type === 'security-scheme',
      ) ===
        'string')
    );
  });
}
