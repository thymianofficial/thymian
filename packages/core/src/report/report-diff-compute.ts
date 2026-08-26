import stringify from 'safe-stable-stringify';

import type { Logger } from '../logger/logger.js';
import { buildRuleIndex, resolveExecutionSeverity } from './finding-render.js';
import { createLocationResolver } from './location-format.js';
import type { Location, Report, RuleDescriptor, ToolRun } from './report.js';
import type {
  ReportDiff,
  ReportDiffChange,
  RuleChange,
  RunResultChange,
} from './report-diff.js';
import { createReportDiff } from './report-diff.js';
import { matchEndpoints } from './report-diff-endpoints.js';

/**
 * One side of a diff: exactly one source report's identity, runs, and format
 * map (#502 AC 1 — multi-report inputs are rejected before this layer).
 */
export interface ReportDiffSide {
  reportId: string;
  createdAt: string;
  runs: ToolRun[];
  thymianFormat?: Report['thymianFormat'];
}

type RunResultCandidate = Omit<RunResultChange, 'change'>;

/**
 * Identity of a failed execution across the two sides (#502 AC 4):
 * rule id + location + failure details (reason + resolved severity), plus
 * the test-case name for test executions. `thymianFormat` locations are
 * canonicalized through the endpoint pairing so a finding on a *changed*
 * endpoint keeps its identity; every other location type compares
 * structurally. Set semantics: identical identities collapse per side.
 */
function collectRunResults(
  side: ReportDiffSide,
  canonicalizeElementId: (elementId: string) => string,
): Map<string, RunResultCandidate> {
  const resolveLocation = createLocationResolver({
    reportId: side.reportId,
    createdAt: side.createdAt,
    runs: side.runs,
    thymianFormat: side.thymianFormat,
  });
  const candidates = new Map<string, RunResultCandidate>();

  for (const run of side.runs) {
    const ruleIndex = buildRuleIndex(run.rules);

    for (const execution of run.executions ?? []) {
      if (execution.status.kind !== 'failed') {
        continue;
      }

      const severity =
        resolveExecutionSeverity(execution, ruleIndex) ?? 'error';
      const reason = execution.status.reason;
      const testCase = execution.kind === 'test' ? execution.name : undefined;
      const location: Location | undefined =
        execution.kind === 'test' ? undefined : execution.location;

      const locationKey =
        location === undefined
          ? ''
          : location.type === 'thymianFormat'
            ? `thymianFormat|${location.elementType}|${canonicalizeElementId(
                location.elementId,
              )}|${location.pointer}`
            : (stringify(location) ?? '');

      const key = stringify({
        runType: run.runType,
        ruleId: execution.ruleId ?? null,
        testCase: testCase ?? null,
        locationKey,
        reason: reason ?? null,
        severity,
      })!;

      if (candidates.has(key)) {
        continue;
      }

      candidates.set(key, {
        kind: 'run-result',
        runType: run.runType,
        severity,
        ...(execution.ruleId !== undefined ? { ruleId: execution.ruleId } : {}),
        ...(reason !== undefined ? { reason } : {}),
        ...(testCase !== undefined ? { testCase } : {}),
        ...(location !== undefined
          ? {
              location,
              locationLabel: resolveLocation(
                location,
                run.thymianFormatVersion,
              ),
            }
          : {}),
      });
    }
  }

  return candidates;
}

/** `rfc9110/response-status` -> `rfc9110`; ids without `/` have no ruleset. */
function rulesetPrefix(ruleId: string): string | undefined {
  const index = ruleId.indexOf('/');

  return index > 0 ? ruleId.slice(0, index) : undefined;
}

function collectRules(side: ReportDiffSide): Map<string, RuleDescriptor> {
  const rules = new Map<string, RuleDescriptor>();

  for (const run of side.runs) {
    for (const rule of run.rules ?? []) {
      if (!rules.has(rule.id)) {
        rules.set(rule.id, rule);
      }
    }
  }

  return rules;
}

/**
 * Rule changes at the right granularity (#502 AC 6): when the other side has
 * no rule of a ruleset's prefix at all, the whole set moved — one `ruleset`
 * entry; otherwise each rule is reported individually.
 */
function groupRuleChanges(
  changedIds: string[],
  changedSideRules: Map<string, RuleDescriptor>,
  otherSideIds: Set<string>,
  change: 'added' | 'removed',
): RuleChange[] {
  const changes: RuleChange[] = [];
  const emittedRulesets = new Set<string>();

  for (const id of [...changedIds].sort()) {
    const prefix = rulesetPrefix(id);
    const otherSideHasPrefix =
      prefix !== undefined &&
      [...otherSideIds].some((otherId) => otherId.startsWith(`${prefix}/`));

    if (prefix !== undefined && !otherSideHasPrefix) {
      if (!emittedRulesets.has(prefix)) {
        emittedRulesets.add(prefix);
        changes.push({ kind: 'rule', change, scope: 'ruleset', id: prefix });
      }
      continue;
    }

    const descriptor = changedSideRules.get(id);

    changes.push({
      kind: 'rule',
      change,
      scope: 'rule',
      id,
      ...(descriptor?.name !== undefined ? { name: descriptor.name } : {}),
    });
  }

  return changes;
}

function runResultSortKey(change: RunResultChange): string {
  return [
    change.change,
    change.runType,
    change.ruleId ?? '',
    change.testCase ?? '',
    change.locationLabel ?? '',
    change.reason ?? '',
    change.severity,
  ].join('|');
}

/**
 * Compute the diff document from two loaded sides. Pure aside from the
 * optional warning when a side carries no usable format graph (AC 5's
 * documented degradation: specification comparison is skipped and
 * `thymianFormat` locations fall back to raw id equality — which is what the
 * empty pairing map yields).
 */
export function computeReportDiff(
  base: ReportDiffSide,
  head: ReportDiffSide,
  logger?: Logger,
): ReportDiff {
  const endpointMatch = matchEndpoints(base.thymianFormat, head.thymianFormat);
  const changes: ReportDiffChange[] = [];

  if (endpointMatch.baseHasFormat && endpointMatch.headHasFormat) {
    changes.push(...endpointMatch.changes);
  } else {
    logger?.warn(
      'Skipping specification comparison: ' +
        (endpointMatch.baseHasFormat ? 'the head' : 'the base') +
        ' report carries no usable embedded Thymian format graph.',
    );
  }

  const baseRules = collectRules(base);
  const headRules = collectRules(head);
  const addedRuleIds = [...headRules.keys()].filter((id) => !baseRules.has(id));
  const removedRuleIds = [...baseRules.keys()].filter(
    (id) => !headRules.has(id),
  );

  changes.push(
    ...groupRuleChanges(
      addedRuleIds,
      headRules,
      new Set(baseRules.keys()),
      'added',
    ),
    ...groupRuleChanges(
      removedRuleIds,
      baseRules,
      new Set(headRules.keys()),
      'removed',
    ),
  );

  const identity = (elementId: string) => elementId;
  const baseResults = collectRunResults(base, identity);
  const headResults = collectRunResults(
    head,
    (elementId) =>
      endpointMatch.headToBaseElementIds.get(elementId) ?? elementId,
  );

  const runResultChanges: RunResultChange[] = [];

  for (const [key, candidate] of headResults) {
    if (!baseResults.has(key)) {
      runResultChanges.push({ ...candidate, change: 'added' });
    }
  }

  for (const [key, candidate] of baseResults) {
    if (!headResults.has(key)) {
      runResultChanges.push({ ...candidate, change: 'removed' });
    }
  }

  runResultChanges.sort((a, b) =>
    runResultSortKey(a).localeCompare(runResultSortKey(b)),
  );
  changes.push(...runResultChanges);

  return createReportDiff(base, head, changes);
}
