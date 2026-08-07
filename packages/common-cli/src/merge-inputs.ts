import {
  isRuleSeverityLevel,
  type RuleFilter,
  type RuleSeverity,
  severityLevelValues,
  type SpecificationInput,
  type TrafficInput,
} from '@thymian/core';

import type { RuleProfileName, RuleSetEntry } from './thymian-config.js';

/**
 * A `ruleSets` entry normalized to its package name and resolved profile.
 * A bare-string entry (or an object without `profile`) resolves to
 * `recommended`.
 */
export interface NormalizedRuleSet {
  name: string;
  profile: RuleProfileName;
}

/**
 * Merge specification inputs from config and CLI flags.
 * Flag values are appended after config values.
 */
export function mergeSpecifications(
  configSpecs: SpecificationInput[] | undefined,
  flagSpecs: SpecificationInput[] | undefined,
): SpecificationInput[] {
  return [...(configSpecs ?? []), ...(flagSpecs ?? [])];
}

/**
 * Merge traffic inputs from config and CLI flags.
 * Flag values are appended after config values.
 */
export function mergeTraffic(
  configTraffic: TrafficInput[] | undefined,
  flagTraffic: TrafficInput[] | undefined,
): TrafficInput[] {
  return [...(configTraffic ?? []), ...(flagTraffic ?? [])];
}

/**
 * Normalize a `ruleSets` entry to `{ name, profile }`. A bare string (or an
 * object without `profile`) resolves to the `recommended` profile.
 */
function normalizeRuleSetEntry(entry: RuleSetEntry): NormalizedRuleSet {
  if (typeof entry === 'string') {
    return { name: entry, profile: 'recommended' };
  }

  return { name: entry.name, profile: entry.profile ?? 'recommended' };
}

/**
 * Merge rule set entries from config and CLI flags into normalized
 * `{ name, profile }` selections. Flag values (always bare strings, resolving
 * to `recommended`) are appended after config values. Duplicate package names
 * are removed, keeping the first occurrence's profile selection.
 */
export function mergeRuleSets(
  configRuleSets: RuleSetEntry[] | undefined,
  flagRuleSets: string[] | undefined,
): NormalizedRuleSet[] {
  const normalized = [...(configRuleSets ?? []), ...(flagRuleSets ?? [])].map(
    normalizeRuleSetEntry,
  );

  const byName = new Map<string, NormalizedRuleSet>();

  for (const entry of normalized) {
    if (!byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }

  return [...byName.values()];
}

/**
 * Split normalized rule-set selections into the specifier list (for the
 * workflow `rules` payload) and the parallel specifier→profile map (for the
 * additive `ruleProfiles` workflow input). Threading the profile selection
 * this way leaves the existing `rules` payload shape unchanged.
 */
export function toRuleSetInputs(ruleSets: NormalizedRuleSet[]): {
  rules: string[];
  ruleProfiles: Record<string, string>;
} {
  const rules = ruleSets.map((ruleSet) => ruleSet.name);
  const ruleProfiles = Object.fromEntries(
    ruleSets.map((ruleSet) => [ruleSet.name, ruleSet.profile]),
  );

  return { rules, ruleProfiles };
}

/**
 * Resolve the effective rule severity from CLI flag and config.
 * CLI flag takes precedence over config value.
 * Default is 'error'.
 */
export function resolveRuleSeverity(
  configSeverity: RuleSeverity | undefined,
  flagSeverity: string | undefined,
): RuleSeverity {
  if (flagSeverity && isRuleSeverityLevel(flagSeverity)) {
    return flagSeverity;
  }

  return configSeverity ?? 'error';
}

/**
 * Create a rule filter from a severity threshold.
 * Only rules whose severity is at or above the threshold will be loaded.
 *
 * Severity hierarchy (most to least severe): error (1) > warn (2) > hint (3) > off (4)
 * - 'error': only loads rules with severity 'error'
 * - 'warn': loads rules with severity 'error' or 'warn'
 * - 'hint': loads rules with severity 'error', 'warn', or 'hint' (all active rules)
 * - 'off': loads no rules
 */
export function createSeverityRuleFilter(severity: RuleSeverity): RuleFilter {
  if (severity === 'off') {
    return () => false;
  }

  return (rule) =>
    severityLevelValues[rule.meta.severity] <= severityLevelValues[severity];
}
