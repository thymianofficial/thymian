import type { Execution, FindingRecord, FindingRelationship } from './report.js';

/** One visited execution together with its position in the execution tree. */
export interface ExecutionVisit {
  /** The visited execution. */
  execution: Execution;
  /** 0 for top-level executions of a run, +1 per nesting level. */
  depth: number;
  /** Ancestor executions, outermost first. Empty at depth 0. */
  ancestors: Execution[];
}

/**
 * Pre-order walk of an execution tree. Yields every execution in
 * {@link Execution.children} recursively, with its depth and ancestor chain so
 * callers can render indentation without re-implementing the recursion.
 */
export function* walkExecutions(
  executions: Execution[] | undefined,
  depth = 0,
  ancestors: Execution[] = [],
): Generator<ExecutionVisit> {
  for (const execution of executions ?? []) {
    yield { execution, depth, ancestors };

    if (execution.children && execution.children.length > 0) {
      yield* walkExecutions(execution.children, depth + 1, [
        ...ancestors,
        execution,
      ]);
    }
  }
}

/** One visited finding together with where it sits in the report tree. */
export interface FindingVisit {
  /** The visited finding. */
  finding: FindingRecord;
  /** Execution that owns the finding (or owns the root of its nested chain). */
  execution: Execution;
  /** Depth of the owning execution (see {@link ExecutionVisit.depth}). */
  depth: number;
  /** Nesting depth inside `nestedFindings`; 0 for a direct execution finding. */
  nestedDepth: number;
  /** Id of the finding this one is nested under, if any. */
  parentFindingId?: string;
  /** Ancestor executions of the owning execution, outermost first. */
  ancestors: Execution[];
}

export interface WalkFindingsOptions {
  /** When true, also descend into each finding's `nestedFindings`. */
  includeNested?: boolean;
}

function* walkNestedFindings(
  relationships: FindingRelationship[] | undefined,
  base: Omit<FindingVisit, 'finding' | 'nestedDepth' | 'parentFindingId'>,
  nestedDepth: number,
  parentFindingId: string,
  seen: WeakSet<FindingRecord>,
): Generator<FindingVisit> {
  for (const relationship of relationships ?? []) {
    const finding = relationship.finding;
    // Guard against cycles: `nestedFindings` references FindingRecord objects
    // and the model does not forbid a finding referencing an ancestor.
    if (seen.has(finding)) {
      continue;
    }
    seen.add(finding);

    yield { ...base, finding, nestedDepth, parentFindingId };

    yield* walkNestedFindings(
      finding.nestedFindings,
      base,
      nestedDepth + 1,
      finding.id,
      seen,
    );
  }
}

/**
 * Walk every finding in an execution tree. Direct execution findings are yielded
 * at `nestedDepth: 0`; when `includeNested` is set, each finding's
 * `nestedFindings` are yielded depth-first with increasing `nestedDepth`.
 */
export function* walkFindings(
  executions: Execution[] | undefined,
  options: WalkFindingsOptions = {},
): Generator<FindingVisit> {
  const includeNested = options.includeNested ?? false;

  for (const { execution, depth, ancestors } of walkExecutions(executions)) {
    for (const finding of execution.findings) {
      yield {
        finding,
        execution,
        depth,
        nestedDepth: 0,
        parentFindingId: undefined,
        ancestors,
      };

      if (includeNested) {
        const seen = new WeakSet<FindingRecord>([finding]);
        yield* walkNestedFindings(
          finding.nestedFindings,
          { execution, depth, ancestors },
          1,
          finding.id,
          seen,
        );
      }
    }
  }
}

/**
 * Flatten all findings of an execution tree into an array, recursing through
 * `children` and (optionally) `nestedFindings`.
 */
export function collectFindings(
  executions: Execution[] | undefined,
  options: WalkFindingsOptions = {},
): FindingRecord[] {
  const findings: FindingRecord[] = [];

  for (const { finding } of walkFindings(executions, options)) {
    findings.push(finding);
  }

  return findings;
}
