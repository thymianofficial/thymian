import type { HttpResponse, RuleViolationLocation } from '@thymian/core';
import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

import {
  type ByteRange,
  formatByteRange,
  intRanges,
  parseRangeHeader,
  unparsableRangeHeader,
} from './utils.js';

const NAME = 'rfc9110/client-should-not-request-inefficient-multiple-ranges';

/*
 * 1. Take the int ranges of the range set and sort them by their first position.
 * 2. Calculate the distance (gap) between the end of range n and the start of range n+1.
 * 3. Trigger an error/warning if (first_{n+1} - last_{n}) < threshold.
 * @param ranges - The parsed range set (e.g., of "bytes=0-100, 150-200")
 * @param threshold - The byte gap below which a single range would be more efficient (default 100)
 * @returns A message describing the first inefficiency found
 */
function validateRangeEfficiency(
  ranges: ByteRange[],
  threshold = 100,
): string | undefined {
  // 1. Sort the int ranges by their first position
  const sorted = intRanges(ranges).sort((a, b) => a.first - b.first);

  // 2. & 3. Iterate and check distances
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!current || !next) {
      continue;
    }

    // An open-ended range runs to the end of the representation, so every
    // range sorted after it overlaps it.
    if (current.last === undefined || next.first <= current.last) {
      return `Ranges ${formatByteRange(current)} and ${formatByteRange(next)} overlap. This is highly inefficient.`;
    }

    // Calculate gap: start of next minus end of current
    // Note: We subtract 1 because bytes 100-200 and 201-300 have a gap of 0.
    const gap = next.first - current.last - 1;

    if (gap < threshold) {
      const single: ByteRange = {
        kind: 'int',
        first: current.first,
        last: next.last,
      };

      return `Inefficient request: Gap between ${current.last} and ${next.first} is only ${gap} bytes.
                  This is less than the threshold of ${threshold} bytes.
                  A single range ${formatByteRange(single)} would be more efficient.`;
    }
  }

  return;
}

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(NAME)
  .severity('warn')
  // A request-side ("client SHOULD NOT") rule, valid only in `analyze` — in
  // `test` Thymian generates the request, so the client's range-splitting choice
  // is not user-controlled.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A client SHOULD NOT request multiple ranges that are inherently less efficient to process and transfer than a single range that encompasses the same data.',
  )
  .summary(
    'A client should not request multiple ranges that are less efficient than a single encompassing range.',
  )
  .explanation(
    'Do not split a request into many byte ranges when a single range covering the same span would be cheaper to fetch, such as overlapping ranges or tiny ranges separated by only a few bytes. Multipart range responses carry per-part overhead and make the server do more work, so a request that fragments what is essentially one contiguous chunk wastes bandwidth and processing and can even look like a denial-of-service pattern.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateHttpTransactions({
      appliesTo: requestHeader('range'),
      violatedWhen: (
        req,
        _res: HttpResponse,
        location: RuleViolationLocation,
      ) => {
        const rangeHeader = getHeader(req.headers, 'range');

        if (rangeHeader === undefined) {
          return [];
        }

        const ranges = parseRangeHeader(rangeHeader);

        if (!ranges) {
          return [unparsableRangeHeader(NAME, location, rangeHeader)];
        }

        const result = validateRangeEfficiency(ranges);

        if (result) {
          return [{ location, violation: { message: result }, findings: [] }];
        } else {
          return [];
        }
      },
    }),
  )
  .done();
