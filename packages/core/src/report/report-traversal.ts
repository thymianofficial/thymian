import type { Execution, FindingRecord, TestStep } from './report.js';

/** One visited execution. Executions are a flat, non-recursive list per run. */
export interface ExecutionVisit {
  /** The visited execution. */
  execution: Execution;
}

/**
 * Walk the executions of a run.
 */
export function* walkExecutions(
  executions: Execution[] | undefined,
): Generator<ExecutionVisit> {
  for (const execution of executions ?? []) {
    yield { execution };
  }
}

/** One visited finding together with where it sits in the report. */
export interface FindingVisit {
  /** The visited finding. */
  finding: FindingRecord;
  /** Execution that owns the finding (directly, or via one of its steps). */
  execution: Execution;
  /** For a test execution, the step that owns the finding; undefined otherwise. */
  step?: TestStep;
}

/**
 * Walk every finding in a run's executions. For lint/analyze executions the
 * execution's own `findings` are yielded; for test executions the findings of
 * each {@link TestStep} are yielded with the owning `step`.
 */
export function* walkFindings(
  executions: Execution[] | undefined,
): Generator<FindingVisit> {
  for (const { execution } of walkExecutions(executions)) {
    if (execution.kind === 'test') {
      for (const step of execution.steps) {
        for (const finding of step.findings) {
          yield { finding, execution, step };
        }
      }
    } else {
      for (const finding of execution.findings) {
        yield { finding, execution };
      }
    }
  }
}

/** Flatten all findings of a run's executions into an array. */
export function collectFindings(
  executions: Execution[] | undefined,
): FindingRecord[] {
  const findings: FindingRecord[] = [];

  for (const { finding } of walkFindings(executions)) {
    findings.push(finding);
  }

  return findings;
}
