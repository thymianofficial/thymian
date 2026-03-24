export interface CoreValidationInput {
  rules?: import('../rules/rule.js').Rule[];
  options?: Record<string, unknown>;
}
