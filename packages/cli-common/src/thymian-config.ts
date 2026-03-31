import type {
  LogLevel,
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

export interface ThymianConfig {
  autoload?: boolean;
  logLevel?: LogLevel;
  specifications?: SpecificationInput[];
  traffic?: TrafficInput[];
  ruleSets?: string[];
  ruleSeverity?: RuleSeverity;
  rules?: RulesConfiguration;
  plugins: Record<string, ThymianPluginConfiguration>;
}
