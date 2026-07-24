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

/**
 * Build a {@link ToolRun}. Generic over `runType` so the `executions` type is
 * correlated with the run kind (a `lint` run only accepts {@link LintExecution}s,
 * etc.) — matching the discriminated {@link ToolRun} union.
 */
export function createToolRun<TRunType extends ToolRun['runType']>(opts: {
  tool: Tool;
  runType: TRunType;
  executions?: Extract<ToolRun, { runType: TRunType }>['executions'];
  rules?: ToolRun['rules'];
  duration?: number;
  thymianFormatVersion?: string;
  artifacts?: ToolRun['artifacts'];
  invocations?: ToolRun['invocations'];
}): ToolRun {
  // The object is built with a fixed `runType`/`executions` pair, but TypeScript
  // cannot correlate the generic `TRunType` back to a single union arm from an
  // object literal, so we assert the constructed run to the union.
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
  } as ToolRun;
}

/**
 * Build a leaf (lint/analyze) execution. Lint and analyze executions share an
 * identical shape and differ only by their `kind` tag, so both are produced by
 * this single parameterized factory; the public {@link createLintExecution} /
 * {@link createAnalyzeExecution} are thin, type-narrowing wrappers over it.
 */
function createLeafExecution(
  kind: 'lint',
  opts: LeafExecutionOptions,
): LintExecution;
function createLeafExecution(
  kind: 'analyze',
  opts: LeafExecutionOptions,
): AnalyzeExecution;
function createLeafExecution(
  kind: 'lint' | 'analyze',
  opts: LeafExecutionOptions,
): LintExecution | AnalyzeExecution {
  return {
    kind,
    ...(opts.ruleId !== undefined ? { ruleId: opts.ruleId } : {}),
    status: opts.status,
    location: opts.location,
    findings: opts.findings ?? [],
  };
}

interface LeafExecutionOptions {
  location: Location;
  status: ExecutionStatus;
  ruleId?: string;
  findings?: FindingRecord[];
}

/** Build a {@link LintExecution} (one rule evaluated against one location). */
export function createLintExecution(opts: LeafExecutionOptions): LintExecution {
  return createLeafExecution('lint', opts);
}

/** Build an {@link AnalyzeExecution} (one rule evaluated against one location). */
export function createAnalyzeExecution(
  opts: LeafExecutionOptions,
): AnalyzeExecution {
  return createLeafExecution('analyze', opts);
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
): LintExecution[] {
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
 * status: a `violation` → `failed`; a `rule-skip` signal → `skipped`; otherwise
 * `passed`. `rule-skip` is a producer signal and is never emitted as a report
 * finding, but any *other* findings on the same entry still are — a rule-skip
 * alongside e.g. an `informational` finding must not be reported as `passed`.
 * The two signals are treated independently rather than gating one on the
 * other's absence.
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

  const ruleSkips = entry.findings.filter(
    (finding) => finding.kind === 'rule-skip',
  );
  if (ruleSkips.length > 0) {
    const reason = ruleSkips
      .map((finding) => finding.reason ?? finding.message)
      .filter((r): r is string => r !== undefined)
      .join('; ');
    return {
      status: { kind: 'skipped', ...(reason ? { reason } : {}) },
      findings: detailFindings,
    };
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
): LintExecution[];
export function executionsFromRunRulesResult<TDiagnostics>(
  result: RunRulesResult<TDiagnostics>,
  rules: Rule[],
  format: ThymianFormat,
  kind: 'lint',
): LintExecution[];
export function executionsFromRunRulesResult<TDiagnostics>(
  result: RunRulesResult<TDiagnostics>,
  rules: Rule[],
  format: ThymianFormat,
  kind: 'analyze',
): AnalyzeExecution[];
export function executionsFromRunRulesResult<TDiagnostics>(
  result: RunRulesResult<TDiagnostics>,
  rules: Rule[],
  format: ThymianFormat,
  kind: 'lint' | 'analyze' = 'lint',
): (LintExecution | AnalyzeExecution)[] {
  const ruleMap = new Map(rules.map((r) => [r.meta.name, r]));
  const executions: (LintExecution | AnalyzeExecution)[] = [];

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

      executions.push(
        kind === 'analyze'
          ? createLeafExecution('analyze', {
              location,
              ruleId: ruleName,
              status,
              findings,
            })
          : createLeafExecution('lint', {
              location,
              ruleId: ruleName,
              status,
              findings,
            }),
      );
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
    ...(finding.transactionIndex !== undefined
      ? { transactionIndex: finding.transactionIndex }
      : {}),
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
    // Findings carry no severity: it is resolved from the execution's
    // `ruleId`/`status`. Transaction linkage (`result.location.transactionIdx`)
    // is carried through so an assertion failure / invalid transaction in the
    // final report can be traced back to the exact HTTP exchange.
    const transactionIndex = result.location?.transactionIdx;
    switch (result.type) {
      case 'assertion-success':
        // The title is the human-readable message (e.g. the assertion
        // description), not the low-level assert operator, so it reads well when
        // printed on its own in the CLI.
        return {
          kind: 'assertion-success',
          title: result.message,
        } satisfies RuleFinding;
      case 'assertion-failure':
        return {
          kind: 'assertion-failure',
          title: result.message,
          expected: result.expected,
          actual: result.actual,
          ...(transactionIndex !== undefined ? { transactionIndex } : {}),
        } satisfies RuleFinding;
      case 'execution-error':
        return {
          kind: 'informational',
          title: result.error,
          message: result.message,
        } satisfies RuleFinding;
      case 'warning':
        return {
          kind: 'informational',
          title: result.message,
          message: result.details ?? result.message,
        } satisfies RuleFinding;
      case 'info':
        return {
          kind: 'informational',
          title: result.message,
          message: result.details ?? result.message,
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
        } satisfies RuleFinding;
      case 'skip':
        return {
          kind: 'informational',
          title: result.message,
          message: result.reason ?? result.message,
        } satisfies RuleFinding;
      case 'invalid-transaction':
        return {
          kind: 'informational',
          title: result.message,
          message: result.details ?? result.message,
          ...(transactionIndex !== undefined ? { transactionIndex } : {}),
        } satisfies RuleFinding;
      default:
        return result satisfies never;
    }
  });
}

export function isLintExecution(
  execution: Execution,
): execution is LintExecution {
  return execution.kind === 'lint';
}

export function isTestCaseExecution(
  execution: Execution,
): execution is TestCaseExecution {
  return execution.kind === 'test';
}

export function isAnalyzeExecution(
  execution: Execution,
): execution is AnalyzeExecution {
  return execution.kind === 'analyze';
}
