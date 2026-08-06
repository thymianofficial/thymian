import type {
  LogLevel,
  ReportInput,
  RulesConfiguration,
  RuleSeverity,
  SpecificationInput,
  TrafficInput,
} from '@thymian/core';

export interface ThymianPluginConfiguration<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> {
  path?: string;
  verbose?: boolean;
  autoload?: boolean;
  options?: Options;
}

/**
 * Name of a recommended rule-configuration profile a rule-set package may ship
 * via its `profiles` map. `recommended` is the default everywhere; opting into
 * `strict` or `minimal` requires the object form of a `ruleSets` entry.
 */
export type RuleProfileName = 'recommended' | 'strict' | 'minimal';

/**
 * A `ruleSets` entry. A bare string (or an object without `profile`) resolves
 * to the `recommended` profile; the object form opts into another profile.
 */
export type RuleSetEntry = string | { name: string; profile?: RuleProfileName };

export interface ThymianConfig {
  autoload?: boolean;
  logLevel?: LogLevel;
  specifications?: SpecificationInput[];
  traffic?: TrafficInput[];
  reports?: ReportInput[];
  ruleSets?: RuleSetEntry[];
  ruleSeverity?: RuleSeverity;
  rules?: RulesConfiguration;
  targetUrl?: string;
  plugins: Record<string, ThymianPluginConfiguration>;
}
