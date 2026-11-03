import type { RuleFnResult, RuleViolationLocation } from '@thymian/core';

// One `range-spec` of a `bytes` range set (RFC 9110 §14.1.2). An `int-range`
// without `last` runs to the end of the representation, and a `suffix-range`
// names its last `length` bytes. Where either one ends or starts depends on
// the representation's length, which the request does not carry, so neither
// position is filled in.
export type ByteRange =
  | { kind: 'int'; first: number; last?: number }
  | { kind: 'suffix'; length: number };

const RANGES_SPECIFIER = /^bytes=(.*)$/i;
const INT_RANGE = /^(\d+)-(\d*)$/;
const SUFFIX_RANGE = /^-(\d+)$/;

function parseRangeSpec(spec: string): ByteRange | undefined {
  const intMatch = spec.match(INT_RANGE);

  if (intMatch) {
    const first = Number(intMatch[1]);

    if (!intMatch[2]) {
      return { kind: 'int', first };
    }

    const last = Number(intMatch[2]);

    return last < first ? undefined : { kind: 'int', first, last };
  }

  const suffixMatch = spec.match(SUFFIX_RANGE);

  return suffixMatch
    ? { kind: 'suffix', length: Number(suffixMatch[1]) }
    : undefined;
}

/**
 * Parses a `Range` header's `bytes` range set. Returns `undefined` when the
 * header is not one: another range unit, any range spec that RFC 9110
 * §14.1.2 does not allow, or more than one field line — `Range` is a single
 * `ranges-specifier` (§14.2), not a list, so field lines do not combine.
 */
export function parseRangeHeader(
  header: string | string[],
): ByteRange[] | undefined {
  const values = [header].flat();

  if (values.length !== 1) {
    return undefined;
  }

  const [, rangeSet] = values[0]?.trim().match(RANGES_SPECIFIER) ?? [];

  if (rangeSet === undefined) {
    return undefined;
  }

  // A range set is a list: recipients accept empty elements (RFC 9110 §5.6.1).
  const specs = rangeSet
    .split(',')
    .map((spec) => spec.trim())
    .filter((spec) => spec !== '');

  if (specs.length === 0) {
    return undefined;
  }

  const ranges: ByteRange[] = [];

  for (const spec of specs) {
    const range = parseRangeSpec(spec);

    if (!range) {
      return undefined;
    }

    ranges.push(range);
  }

  return ranges;
}

// Where a suffix range starts depends on the representation's length, which
// the request does not carry, so only the int ranges can be placed against
// each other.
export function intRanges(
  ranges: ByteRange[],
): Extract<ByteRange, { kind: 'int' }>[] {
  return ranges.filter((range) => range.kind === 'int');
}

// A range spec as it is written in the header: `0-499`, `500-` or `-500`.
export function formatByteRange(range: ByteRange): string {
  return range.kind === 'suffix'
    ? `-${range.length}`
    : `${range.first}-${range.last ?? ''}`;
}

// A header that is no bytes range set leaves the rule nothing to decide, and
// it says so rather than passing the transaction.
export function unparsableRangeHeader(
  ruleName: string,
  location: RuleViolationLocation,
  header: string | string[],
): RuleFnResult {
  return {
    location,
    findings: [
      {
        title: ruleName,
        kind: 'rule-skip',
        message: `Range header "${[header].flat().join(', ')}" is not a bytes range set.`,
      },
    ],
  };
}
