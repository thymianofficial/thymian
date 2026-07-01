import { randomUUID } from 'node:crypto';

import type { ThymianFormat } from '../format/index.js';
import type { HttpTestCaseResult } from '../http-testing/http-test/http-test-case-result.js';
import type { Rule } from '../rules/rule.js';
import type { RunRulesResult } from '../rules/rule-runner.js';
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
  AnalyzeExecution,
  Execution,
  ExecutionStatus,
  FindingRecord,
  LintExecution,
  Location,
  Report,
  ReportHttpTransaction,
  RuleDescriptor,
  TestCaseExecution,
  TestStep,
  Tool,
  ToolRun,
} from './report.js';

export function createReport(
  runs: ToolRun[],
  thymianFormat?: Report['thymianFormat'],
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
  runType: 'lint' | 'test' | 'analyze';
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

/** Build a {@link LintExecution} (one rule evaluated against one location). */
export function createLintExecution(opts: {
  location: Location;
  status: ExecutionStatus;
  ruleId?: string;
  findings?: FindingRecord[];
}): LintExecution {
  return {
    kind: 'lint',
    ...(opts.ruleId !== undefined ? { ruleId: opts.ruleId } : {}),
    status: opts.status,
    location: opts.location,
    findings: opts.findings ?? [],
  };
}

/** Build an {@link AnalyzeExecution} (one rule evaluated against one location). */
export function createAnalyzeExecution(opts: {
  location: Location;
  status: ExecutionStatus;
  ruleId?: string;
  findings?: FindingRecord[];
}): AnalyzeExecution {
  return {
    kind: 'analyze',
    ...(opts.ruleId !== undefined ? { ruleId: opts.ruleId } : {}),
    status: opts.status,
    location: opts.location,
    findings: opts.findings ?? [],
  };
}

/** Build a {@link TestCaseExecution}; findings live on its {@link TestStep}s. */
export function createTestCaseExecution(opts: {
  name: string;
  status: ExecutionStatus;
  ruleId?: string;
  steps?: TestStep[];
}): TestCaseExecution {
  return {
    kind: 'test',
    ...(opts.ruleId !== undefined ? { ruleId: opts.ruleId } : {}),
    status: opts.status,
    name: opts.name,
    steps: opts.steps ?? [],
  };
}

/** Build a {@link TestStep}. */
export function createTestStep(opts: {
  name: string;
  location: Location;
  findings?: FindingRecord[];
  httpTransactions?: ReportHttpTransaction[];
}): TestStep {
  return {
    name: opts.name,
    location: opts.location,
    findings: opts.findings ?? [],
    ...(opts.httpTransactions !== undefined
      ? { httpTransactions: opts.httpTransactions }
      : {}),
  };
}

/**
 * Build lint executions from resolved rule violations. Each violation becomes a
 * single failed {@link LintExecution} keyed by its `(rule × location)`. The
 * resolved severity is preserved via the `failed` status override.
 */
export function executionsFromViolations(
  violations: EvaluatedRuleViolation[],
  format: ThymianFormat,
): Execution[] {
  return violations.map((evaluatedViolation) => {
    const { location } = resolveViolationLocation(
      evaluatedViolation.location,
      format,
      evaluatedViolation.ruleName,
    );

    return createLintExecution({
      location,
      ruleId: evaluatedViolation.ruleName,
      status: {
        kind: 'failed',
        reason: evaluatedViolation.message,
        severity: evaluatedViolation.severity,
      },
    });
  });
}

/**
 * Determine the {@link ExecutionStatus} and detail findings for a single
 * {@link RuleFnResult} entry. Outcomes that used to be findings now live on the
 * status: a `violation` → `failed`; a `rule-skip`-only result → `skipped`;
 * otherwise `passed`. `rule-skip` is a producer signal and is never emitted as a
 * report finding.
 */
function statusAndFindingsFromEntry(
  entry: { violation?: { message?: string }; findings: RuleFinding[] },
  rule: Rule,
): { status: ExecutionStatus; findings: FindingRecord[] } {
  const detailFindings = entry.findings
    .map((finding) => ruleFindingToFindingRecord(finding))
    .filter((finding): finding is FindingRecord => finding !== undefined);

  if (entry.violation !== undefined) {
    const message =
      entry.violation.message ||
      (rule.meta.summary ?? rule.meta.description ?? rule.meta.name);
    // Severity is resolved from the execution's `ruleId`; a RuleFnResult
    // violation carries no severity override, so it is omitted here.
    return {
      status: { kind: 'failed', reason: message },
      findings: detailFindings,
    };
  }

  if (detailFindings.length === 0) {
    const skip = entry.findings.find((finding) => finding.kind === 'rule-skip');
    if (skip) {
      const reason = skip.reason ?? skip.message;
      return {
        status: { kind: 'skipped', ...(reason ? { reason } : {}) },
        findings: [],
      };
    }
  }

  return { status: { kind: 'passed' }, findings: detailFindings };
}

/**
 * Build report {@link Execution}s from a full {@link RunRulesResult}. Emits one
 * flat leaf execution per `(rule × location)` entry — there is no per-rule
 * grouping wrapper. Passing entries are emitted as `passed` executions (they are
 * no longer skipped as noise); violations become `failed` status and `rule-skip`
 * becomes `skipped` status.
 */
export function executionsFromRunRulesResult<TDiagnostics>(
  result: RunRulesResult<TDiagnostics>,
  rules: Rule[],
  format: ThymianFormat,
  kind: 'lint' | 'analyze' = 'lint',
): Execution[] {
  const ruleMap = new Map(rules.map((r) => [r.meta.name, r]));
  const executions: Execution[] = [];
  const build =
    kind === 'analyze' ? createAnalyzeExecution : createLintExecution;

  for (const [ruleName, { ruleFnResult }] of Object.entries(result)) {
    const rule = ruleMap.get(ruleName);
    if (!rule) {
      continue;
    }

    for (const entry of ruleFnResult) {
      const { location } = resolveViolationLocation(
        entry.location,
        format,
        ruleName,
      );
      const { status, findings } = statusAndFindingsFromEntry(entry, rule);

      executions.push(build({ location, ruleId: ruleName, status, findings }));
    }
  }

  return executions;
}

/**
 * Map a rule-author {@link RuleFinding} to a report {@link FindingRecord}, or
 * `undefined` when the finding is a producer-only signal that must not surface as
 * a report finding.
 *
 * `rule-skip` is filtered out here: it is a signal the builder maps to
 * `status: skipped`, never a report finding. Report findings also carry neither
 * `ruleId` (inherited from the execution) nor `severity` (a violation's severity
 * is resolved from the execution's `ruleId`/`status`).
 */
export function ruleFindingToFindingRecord(
  finding: RuleFinding,
): FindingRecord | undefined {
  if (finding.kind === 'rule-skip') {
    return undefined;
  }

  return {
    id: randomUUID(),
    kind: finding.kind,
    title: finding.title,
    ...(finding.message ? { message: { text: finding.message } } : {}),
    ...(finding.expected !== undefined ? { expected: finding.expected } : {}),
    ...(finding.actual !== undefined ? { actual: finding.actual } : {}),
  } satisfies FindingRecord;
}

export function ruleFindingsToFindingRecords(
  findings: RuleFinding[],
): FindingRecord[] {
  return findings
    .map((finding) => ruleFindingToFindingRecord(finding))
    .filter((finding): finding is FindingRecord => finding !== undefined);
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
      // `timeout`/`skip`/`invalid-transaction` are produced only by the test
      // runner, never by the lint/analyze rule path that consumes this helper.
      // They are mapped defensively to `informational` so no information is lost
      // if that assumption ever changes (test-case outcomes are `status` now).
      case 'timeout':
        return {
          kind: 'informational',
          title: result.message,
          message: result.message,
          severity: 'error',
        } satisfies RuleFinding;
      case 'skip':
        return {
          kind: 'informational',
          title: result.message,
          message: result.reason ?? result.message,
          severity: 'info',
        } satisfies RuleFinding;
      case 'invalid-transaction':
        return {
          kind: 'informational',
          title: result.message,
          message: result.details ?? result.message,
          severity: 'error',
        } satisfies RuleFinding;
      default:
        return result satisfies never;
    }
  });
}
