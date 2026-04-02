import {
  isRuleSeverityLevel,
  type RuleFilter,
  type RuleSeverity,
  severityLevelValues,
  type SpecificationInput,
  type TrafficInput,
} from '@thymian/core';

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
 * Merge rule set package names from config and CLI flags.
 * Flag values are appended after config values. Duplicates are removed.
 */
export function mergeRuleSets(
  configRuleSets: string[] | undefined,
  flagRuleSets: string[] | undefined,
): string[] {
  return [...new Set([...(configRuleSets ?? []), ...(flagRuleSets ?? [])])];
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
