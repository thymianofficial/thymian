export interface CoreValidationInput {
  rules?: import('../rules/rule.js').Rule[];
  rulesConfig?: import('../rules/rule-configuration.js').RulesConfiguration;
  options?: Record<string, unknown>;
}
