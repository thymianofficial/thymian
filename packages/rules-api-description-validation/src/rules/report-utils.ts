import {
  httpTestResultToRuleFindings,
  type HttpTestCaseResult,
  type RuleExecutionResult,
  type RuleFnResult,
  type RuleViolation,
} from '@thymian/core';

export function normalizeViolations(result: RuleFnResult): RuleViolation[] {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    return result;
  }

  if (typeof result === 'object' && 'violations' in result) {
    return result.violations;
  }

  return [result];
}

export function withStructuredFindings(
  result: RuleFnResult,
  findings: HttpTestCaseResult[],
): RuleExecutionResult {
  return {
    violations: normalizeViolations(result),
    findings: httpTestResultToRuleFindings(findings),
  };
}
