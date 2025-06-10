import { filter, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { ThymianHttpTestTransaction } from '../http-test-case.js';

export function requireAuthorization(
  requireAuthorization = true
): MonoTypeOperatorFunction<HttpTestInstance<ThymianHttpTestTransaction>> {
  return filter(({ curr, ctx }) => {
    return (
      requireAuthorization ===
      (typeof ctx.format.graph.findOutNeighbor(
        curr.thymianReqId,
        (id, node) => node.type === 'security-scheme'
      ) ===
        'string')
    );
  });
}
