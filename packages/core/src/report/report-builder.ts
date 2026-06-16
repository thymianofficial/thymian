import { randomUUID } from 'node:crypto';

import type {
  SerializedThymianFormat,
  ThymianFormat,
} from '../format/index.js';
import type { HttpTestCaseResult } from '../http-testing/http-test/http-test-case-result.js';
import type { Rule } from '../rules/rule.js';
import {
  isRuleEnabled,
  resolveViolationLocation,
} from '../rules/rule-runner.js';
import type { RuleSeverity } from '../rules/rule-severity.js';
import type {
  EvaluatedRuleViolation,
  RuleFinding,
} from '../rules/rule-violation.js';
import type {
  Execution,
  FindingRecord,
  Location,
  Report,
  ReportHttpTransaction,
  RuleDescriptor,
  Tool,
  ToolRun,
} from './report.js';

export function createReport(
  runs: ToolRun[],
  thymianFormat?: SerializedThymianFormat,
): Report {
  return {
    reportId: randomUUID(),
    createdAt: new Date().toISOString(),
    runs,
    thymianFormat,
  };
}

export function createToolRun(opts: {
  tool: Tool;
  runType: string;
  executions?: Execution[];
  rules?: ToolRun['rules'];
  duration?: number;
  thymianFormatVersion?: string;
  artifacts?: ToolRun['artifacts'];
  invocations?: ToolRun['invocations'];
}): ToolRun {
  return {
    runId: randomUUID(),
    tool: opts.tool,
    runType: opts.runType,
    runAt: new Date().toISOString(),
    duration: opts.duration,
    thymianFormatVersion: opts.thymianFormatVersion,
    artifacts: opts.artifacts,
    invocations: opts.invocations,
    executions: opts.executions,
    rules: opts.rules,
  };
}

export function createExecution(opts: {
  location: Location;
  findings?: FindingRecord[];
  children?: Execution[];
  httpTransactions?: ReportHttpTransaction[];
  name?: string;
  description?: string;
}): Execution {
  return {
    name: opts.name,
    description: opts.description,
    location: opts.location,
    findings: opts.findings ?? [],
    children: opts.children,
    httpTransactions: opts.httpTransactions,
  };
}

export function executionsFromViolations(
  violations: EvaluatedRuleViolation[],
  format: ThymianFormat,
): Execution[] {
  const grouped = new Map<string, Execution>();

  for (const evaluatedViolation of violations) {
    const { heading, location } = resolveViolationLocation(
      evaluatedViolation.violation,
      format,
      evaluatedViolation.ruleName,
    );
    const key = `${heading}::${JSON.stringify(location)}`;
    const execution =
      grouped.get(key) ??
      createExecution({
        location,
        name: heading,
        findings: [],
      });

    execution.findings.push({
      id: randomUUID(),
      kind: 'rule-violation',
      ruleId: evaluatedViolation.ruleName,
      title: evaluatedViolation.violation.message,
      message: { text: evaluatedViolation.violation.message },
      severity: evaluatedViolation.severity,
    });

    grouped.set(key, execution);
  }

  return [...grouped.values()];
}

export function ruleFindingToFindingRecord(
  finding: RuleFinding,
  fallbackRuleId?: string,
): FindingRecord {
  return {
    id: randomUUID(),
    kind: finding.kind,
    title: finding.title,
    message: finding.message ? { text: finding.message } : undefined,
    severity: finding.severity ?? 'info',
    ...(finding.ruleId || fallbackRuleId
      ? { ruleId: finding.ruleId ?? fallbackRuleId }
      : {}),
    ...(finding.expected !== undefined ? { expected: finding.expected } : {}),
    ...(finding.actual !== undefined ? { actual: finding.actual } : {}),
    ...(finding.reason ? { reason: finding.reason } : {}),
    ...(finding.durationMilliseconds !== undefined
      ? { durationMilliseconds: finding.durationMilliseconds }
      : {}),
  } satisfies FindingRecord;
}

export function ruleFindingsToFindingRecords(
  findings: RuleFinding[],
  fallbackRuleId?: string,
): FindingRecord[] {
  return findings.map((finding) =>
    ruleFindingToFindingRecord(finding, fallbackRuleId),
  );
}

/**
 * Map executed rules to report {@link RuleDescriptor}s for `ToolRun.rules`.
 * Applies the same filter as `runRules` (enabled, not informational-only) plus
 * an additional mode filter: only rules that the adapter would actually run
 * (i.e. `getRuleFn(rule)` returns a truthy function) are included.
 */
export function rulesToRuleDescriptors(
  rules: Rule[],
  getRuleFn: (rule: Rule) => unknown,
): RuleDescriptor[] {
  return rules
    .filter((rule) => isRuleEnabled(rule) && Boolean(getRuleFn(rule)))
    .map((rule) => ({
      id: rule.meta.name,
      severity: rule.meta.severity as Exclude<RuleSeverity, 'off'>,
      ...(rule.meta.description
        ? { description: { text: rule.meta.description } }
        : {}),
      ...(rule.meta.summary ? { summary: { text: rule.meta.summary } } : {}),
      ...(rule.meta.explanation
        ? { explanation: { text: rule.meta.explanation } }
        : {}),
      ...(rule.meta.url ? { helpUri: rule.meta.url } : {}),
    }));
}

export function httpTestResultToRuleFindings(
  results: HttpTestCaseResult[],
): RuleFinding[] {
  return results.map((result) => {
    switch (result.type) {
      case 'assertion-success':
        return {
          kind: 'assertion-success',
          title: result.assertion ?? result.message,
          message: result.message,
          severity: 'info',
        } satisfies RuleFinding;
      case 'assertion-failure':
        return {
          kind: 'assertion-failure',
          title: result.assertion ?? result.message,
          message: result.message,
          severity: 'error',
          expected: result.expected,
          actual: result.actual,
        } satisfies RuleFinding;
      case 'execution-error':
        return {
          kind: 'informational',
          title: result.error,
          message: result.message,
          severity: 'error',
        } satisfies RuleFinding;
      case 'timeout':
        return {
          kind: 'test-case-fail',
          title: result.message,
          message: result.message,
          severity: 'error',
          durationMilliseconds: result.durationMs,
        } satisfies RuleFinding;
      case 'skip':
        return {
          kind: 'test-case-skip',
          title: result.message,
          message: result.message,
          severity: 'info',
          reason: result.reason ?? result.message,
        } satisfies RuleFinding;
      case 'warning':
        return {
          kind: 'informational',
          title: result.message,
          message: result.details ?? result.message,
          severity: 'warn',
        } satisfies RuleFinding;
      case 'info':
        return {
          kind: 'informational',
          title: result.message,
          message: result.details ?? result.message,
          severity: 'info',
        } satisfies RuleFinding;
      case 'invalid-transaction':
        return {
          kind: 'test-case-fail',
          title: result.message,
          message: result.details ?? result.message,
          severity: 'error',
        } satisfies RuleFinding;
      default:
        return result satisfies never;
    }
  });
}
