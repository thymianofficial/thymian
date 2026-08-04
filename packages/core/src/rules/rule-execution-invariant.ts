import type { Rule } from './rule.js';
import { type RuleType, ruleTypes } from './rule-meta.js';

export type ExecutableRuleType = Exclude<RuleType, 'informational'>;

export const ruleFnPropertyByType = {
  static: 'lintRule',
  analytics: 'analyzeRule',
  test: 'testRule',
} as const satisfies Record<ExecutableRuleType, keyof Rule>;

export type RuleExecutionInvariantViolation =
  | { reason: 'invalid-type-declaration' }
  | { reason: 'unknown-rule-types'; unknownTypes: string[] }
  | { reason: 'informational-mixed-with-executable-types' }
  | { reason: 'informational-rule-with-execution-function' }
  | {
      reason: 'missing-execution-function';
      missingTypes: ExecutableRuleType[];
    };

// Rules can be hand-constructed without the httpRule builder, so meta.type
// may be missing, not an array, empty, or contain unknown entries. This
// shape check is separate from the coverage check below because rule
// filters dereference meta.type — a malformed declaration must be rejected
// before a filter (or the coverage check) can run on it.
export function checkRuleTypeDeclaration<
  Options extends Record<PropertyKey, unknown>,
>(rule: Rule<Options>): RuleExecutionInvariantViolation | undefined {
  const types: unknown = rule.meta.type;

  if (!Array.isArray(types) || types.length === 0) {
    return { reason: 'invalid-type-declaration' };
  }

  const unknownTypes = types.filter(
    (type) => !ruleTypes.includes(type as RuleType),
  );

  if (unknownTypes.length > 0) {
    return {
      reason: 'unknown-rule-types',
      unknownTypes: unknownTypes.map(String),
    };
  }

  return undefined;
}

// The rule runner silently skips a rule whose execution function for the
// current mode is missing, so a rule violating this invariant registers but
// never runs (see #358/#359 in thymian-internal). The invariant: every
// declared executable type has its execution function, and 'informational'
// is exclusive and function-free.
export function checkRuleExecutionInvariant<
  Options extends Record<PropertyKey, unknown>,
>(rule: Rule<Options>): RuleExecutionInvariantViolation | undefined {
  const declarationViolation = checkRuleTypeDeclaration(rule);

  if (declarationViolation) {
    return declarationViolation;
  }

  const types = rule.meta.type;

  if (types.includes('informational')) {
    if (types.some((type) => type !== 'informational')) {
      return { reason: 'informational-mixed-with-executable-types' };
    }

    if (rule.lintRule || rule.analyzeRule || rule.testRule) {
      return { reason: 'informational-rule-with-execution-function' };
    }

    return undefined;
  }

  const missingTypes = [...new Set(types as ExecutableRuleType[])].filter(
    (type) => typeof rule[ruleFnPropertyByType[type]] !== 'function',
  );

  if (missingTypes.length > 0) {
    return { reason: 'missing-execution-function', missingTypes };
  }

  return undefined;
}

export function describeRuleExecutionInvariantViolation(
  ruleName: string,
  violation: RuleExecutionInvariantViolation,
): { message: string; suggestions: string[] } {
  switch (violation.reason) {
    case 'invalid-type-declaration':
      return {
        message: `Rule "${ruleName}" does not declare valid rule types. meta.type must be a non-empty array of rule types.`,
        suggestions: [
          `Declare at least one of the rule types: ${ruleTypes.join(', ')}.`,
        ],
      };
    case 'unknown-rule-types':
      return {
        message: `Rule "${ruleName}" declares unknown rule type(s): ${violation.unknownTypes.join(', ')}. Known rule types are: ${ruleTypes.join(', ')}.`,
        suggestions: ['Remove or correct the unknown rule types.'],
      };
    case 'informational-mixed-with-executable-types':
      return {
        message: `Rule "${ruleName}" combines 'informational' with executable rule types. 'informational' must be the only type of a rule.`,
        suggestions: [
          "Remove 'informational' from the rule types, or make it the only type.",
        ],
      };
    case 'informational-rule-with-execution-function':
      return {
        message: `Rule "${ruleName}" is informational but defines an execution function. Informational rules must not have execution functions.`,
        suggestions: [
          'Remove the execution function, or declare executable rule types instead.',
        ],
      };
    case 'missing-execution-function':
      return {
        message: `Rule "${ruleName}" has no execution function for declared type(s): ${violation.missingTypes.join(', ')}. The rule would register but never run.`,
        suggestions: [
          'Define an execution function with .rule() or the matching .override*Rule().',
          "Declare the rule with .type('informational') if it is documentation-only.",
        ],
      };
  }
}
