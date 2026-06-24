import type { FindingRecord, RuleDescriptor } from './report.js';

/** A single label/value detail extracted from a finding for rendering. */
export interface FindingDetail {
  /** Stable label, e.g. `rule`, `expected`, `actual`, `reason`, `duration`. */
  label: string;
  /** Plain-text value. */
  value: string;
}

/** Build an `id -> descriptor` lookup from a run's rules list. */
export function buildRuleIndex(
  rules: RuleDescriptor[] | undefined,
): ReadonlyMap<string, RuleDescriptor> {
  const index = new Map<string, RuleDescriptor>();

  for (const rule of rules ?? []) {
    index.set(rule.id, rule);
  }

  return index;
}

/** Extract the `ruleId` of any finding that carries one, else `undefined`. */
export function findingRuleId(finding: FindingRecord): string | undefined {
  return 'ruleId' in finding && typeof finding.ruleId === 'string'
    ? finding.ruleId
    : undefined;
}

/**
 * Extract the kind-specific detail lines for a finding as plain label/value
 * pairs. Renderers decide layout (indented lines, table cells, CSV columns) and
 * apply their own coloring. When a {@link RuleDescriptor} index is provided,
 * rule findings are enriched with the descriptor's name/summary/helpUri.
 */
export function findingDetails(
  finding: FindingRecord,
  ruleIndex?: ReadonlyMap<string, RuleDescriptor>,
): FindingDetail[] {
  const details: FindingDetail[] = [];

  const ruleId = findingRuleId(finding);
  if (ruleId !== undefined) {
    details.push({ label: 'rule', value: ruleId });

    const descriptor = ruleIndex?.get(ruleId);
    if (descriptor) {
      if (descriptor.name) {
        details.push({ label: 'rule name', value: descriptor.name });
      }
      if (descriptor.summary?.text) {
        details.push({ label: 'summary', value: descriptor.summary.text });
      }
      if (descriptor.helpUri) {
        details.push({ label: 'help', value: descriptor.helpUri });
      }
    }
  }

  switch (finding.kind) {
    case 'rule-skip':
    case 'test-case-skip': {
      const { reason } = finding as { reason?: string };
      if (reason) {
        details.push({ label: 'reason', value: reason });
      }
      break;
    }
    case 'assertion-failure': {
      const { expected, actual } = finding as {
        expected?: unknown;
        actual?: unknown;
      };
      details.push({ label: 'expected', value: JSON.stringify(expected) });
      details.push({ label: 'actual', value: JSON.stringify(actual) });
      break;
    }
    case 'test-case-pass':
    case 'test-case-fail': {
      const { durationMilliseconds } = finding as {
        durationMilliseconds?: number;
      };
      if (durationMilliseconds !== undefined) {
        details.push({ label: 'duration', value: `${durationMilliseconds}ms` });
      }
      break;
    }
    default:
      break;
  }

  return details;
}
