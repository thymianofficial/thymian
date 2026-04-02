import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

import { parseRangeHeader } from './utils.js';

function validateRangeOrder(
  rangeHeader: string | string[],
): string | undefined {
  const ranges = parseRangeHeader(rangeHeader);

  for (let i = 0; i < ranges.length - 1; i++) {
    const current = ranges[i];
    const next = ranges[i + 1];

    if (!current || !next) {
      continue;
    }

    if (next.start < current.start) {
      return `Inefficient order: Range ${next.start}-${next.end} appears after ${current.start}-${current.end}.
                  Ranges should be listed in ascending order to optimize server-side processing and representation flow.`;
    }
  }

  return;
}

export default httpRule(
  'rfc9110/client-should-list-multiple-ranges-in-ascending-order',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A client that is requesting multiple ranges SHOULD list those ranges in ascending order (the order in which they would typically be received in a complete representation) unless there is a specific need to request a later part earlier.',
  )
  .summary(
    'Client should list multiple ranges in ascending order unless there is a specific need to request a later part earlier.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('range'), (req) => {
      const rangeHeader = getHeader(req.headers, 'range');

      if (!rangeHeader) {
        return false;
      }

      const result = validateRangeOrder(rangeHeader);

      if (result) {
        return {
          message: result,
        };
      } else {
        return false;
      }
    }),
  )
  .done();
