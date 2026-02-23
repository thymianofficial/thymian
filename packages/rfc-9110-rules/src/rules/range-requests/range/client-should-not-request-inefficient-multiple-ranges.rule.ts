import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { parseRangeHeader } from './utils.js';

/*
 * 1. Extract all (start, end) pairs from the Range header.
 * 2. Sort them by their start value.
 * 3. Calculate the distance (gap) between the end of range n and the start of range n+1.
 * 4. Trigger an error/warning if (start_{n+1} - end_{n}) < threshold.
 * * @param rangeHeader - The raw Range header string (e.g., "bytes=0-100, 150-200")
 * @param threshold - The byte gap below which a single range would be more efficient (default 100)
 * @returns An object containing the validity and a message
 */
function validateRangeEfficiency(
  rangeHeader: string | string[],
  threshold = 100,
): string | undefined {
  if (Array.isArray(rangeHeader)) {
    // returns the first error message it finds
    return rangeHeader
      .map(validateRangeEfficiency)
      .reduce((acc, curr) => acc || curr);
  }

  // 1. Extract all (start, end) pairs from the Range header.
  const ranges = parseRangeHeader(rangeHeader);

  // 2. Sort by start value
  ranges.sort((a, b) => a.start - b.start);

  // 3. & 4. Iterate and check distances
  for (let i = 0; i < ranges.length - 1; i++) {
    const current = ranges[i];
    const next = ranges[i + 1];

    if (!current || !next) {
      continue;
    }

    // Calculate gap: start of next minus end of current
    // Note: We subtract 1 because bytes 100-200 and 201-300 have a gap of 0.
    const gap = next.start - current.end - 1;

    if (gap < 0) {
      return `Ranges ${current.start}-${current.end} and ${next.start}-${next.end} overlap. This is highly inefficient.`;
    }

    if (gap < threshold) {
      return `Inefficient request: Gap between ${current.end} and ${next.start} is only ${gap} bytes.
                  This is less than the threshold of ${threshold} bytes.
                  A single range from ${current.start} to ${next.end} would be more efficient.`;
    }
  }

  return;
}

export default httpRule(
  'rfc9110/client-should-not-request-inefficient-multiple-ranges',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A client SHOULD NOT request multiple ranges that are inherently less efficient to process and transfer than a single range that encompasses the same data.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('range'), (req) => {
      const rangeHeader = getHeader(req.headers, 'range');

      if (!rangeHeader) {
        return false;
      }

      const result = validateRangeEfficiency(rangeHeader);

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
