import { ux } from '@oclif/core';
import {
  type AnalyzeExecution,
  type LintExecution,
  type LocationResolver,
  resolveExecutionSeverity,
  type RuleDescriptor,
  type Severity,
  SEVERITY_COLORS,
  SEVERITY_SYMBOLS,
  type SortReportsBy,
  type TestCaseExecution,
  type ToolRun,
} from '@thymian/core';

import { renderStatus } from './status.js';
import { indent, pluralizeSeverity, sortRecordByKey } from './utils.js';

type Groupable = LintExecution | TestCaseExecution | AnalyzeExecution;

export type GroupExecutionsFn<T extends Groupable> = (execution: T) => string;

export type RenderExecutionDetailsFn<T extends Groupable> = (
  execution: T,
  indentationLevel: number,
  locationResolver: LocationResolver,
  toolRun: ToolRun,
) => string[];

/** Context every per-execution entry renderer receives. */
export type ExecutionEntryContext = {
  ruleIndex: ReadonlyMap<string, RuleDescriptor>;
  locationResolver: LocationResolver;
  toolRun: ToolRun;
};

/** Renders a group's heading text — already colorized, without indentation. */
export type RenderGroupHeadingFn<T extends Groupable> = (
  key: string,
  group: T[],
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
) => string;

/** Renders one non-passed execution's full block, from `indentationLevel`. */
export type RenderExecutionEntryFn<T extends Groupable> = (
  execution: T,
  indentationLevel: number,
  context: ExecutionEntryContext,
) => string[];

export type RenderExecutionForRun<T extends Groupable> = (
  executions: T[],
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  locationResolver: LocationResolver,
  toolRun: ToolRun,
) => string[];

export function createExecutionsRenderer<T extends Groupable>(
  groupBy: GroupExecutionsFn<T>,
  renderHeading: RenderGroupHeadingFn<T>,
  renderEntry: RenderExecutionEntryFn<T>,
  indentationLevel: number,
  sortGroups: (
    record: Record<string, T[]>,
  ) => Record<string, T[]> = sortRecordByKey,
): RenderExecutionForRun<T> {
  return function (executions, ruleIndex, locationResolver, toolRun) {
    const groups = executions.reduce(
      (grouped, execution) => {
        const key = groupBy(execution);

        grouped[key] ??= [];
        grouped[key]?.push(execution);

        return grouped;
      },
      Object.create(null) as Record<string, T[]>,
    );

    const lines: string[] = [];
    for (const [key, group] of Object.entries(sortGroups(groups))) {
      if (!group.some((execution) => execution.status.kind !== 'passed')) {
        continue;
      }

      lines.push(
        indent(indentationLevel) + renderHeading(key, group, ruleIndex),
      );
      lines.push('');

      for (const execution of group) {
        if (execution.status.kind === 'passed') {
          continue;
        }

        lines.push(
          ...renderEntry(execution, indentationLevel + 1, {
            ruleIndex,
            locationResolver,
            toolRun,
          }),
        );

        lines.push('');
      }
    }

    return lines;
  };
}

/**
 * Picks the grouping-key function for a `--sort-reports-by` mode. `rule` and
 * `severity` are run-type agnostic; `endpoint` falls back to the surface's
 * historical key (location for lint/analyze, test-case name for test) supplied
 * by the caller.
 */
export function selectGroupBy<T extends Groupable>(
  sortReportsBy: SortReportsBy,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  endpointKey: GroupExecutionsFn<T>,
): GroupExecutionsFn<T> {
  switch (sortReportsBy) {
    case 'rule':
      return (execution) => execution.ruleId ?? 'unnamed check';
    case 'severity':
      return (execution) =>
        resolveExecutionSeverity(execution, ruleIndex) ??
        // Skipped executions have no severity; give them their own group
        // rather than mislabelling them as errors.
        (execution.status.kind === 'skipped' ? 'skipped' : 'error');
    case 'endpoint':
      return endpointKey;
  }
}

/** Picks the group-heading renderer for a `--sort-reports-by` mode. */
export function selectHeading<T extends Groupable>(
  sortReportsBy: SortReportsBy,
): RenderGroupHeadingFn<T> {
  switch (sortReportsBy) {
    case 'rule':
      return ruleHeading;
    case 'severity':
      return severityHeading;
    case 'endpoint':
      return endpointHeading;
  }
}

/**
 * Picks the per-execution entry renderer for a `--sort-reports-by` mode.
 * `endpoint` keeps the historical status-line layout; `rule`/`severity` lead
 * each violation with its location (the identity the group heading no longer
 * carries) plus the reason, showing the rule id only when grouping by severity.
 */
export function selectEntry<T extends Groupable>(
  sortReportsBy: SortReportsBy,
  renderDetails: RenderExecutionDetailsFn<T>,
  labelOf: (
    execution: T,
    locationResolver: LocationResolver,
    toolRun: ToolRun,
  ) => string,
): RenderExecutionEntryFn<T> {
  if (sortReportsBy === 'endpoint') {
    return endpointEntryRenderer(renderDetails);
  }

  return groupedEntryRenderer(renderDetails, {
    labelOf,
    showRule: sortReportsBy === 'severity',
  });
}

// --- Heading renderers -----------------------------------------------------

/** `endpoint`: the raw group key (location / test-case name), underlined. */
const endpointHeading: RenderGroupHeadingFn<Groupable> = (key) =>
  ux.colorize('underline', key);

/** `rule`: the rule's severity symbol, then the rule id underlined. */
const ruleHeading: RenderGroupHeadingFn<Groupable> = (
  key,
  group,
  ruleIndex,
) => {
  const severity =
    ruleIndex.get(key)?.severity ?? groupSeverity(group, ruleIndex);
  return `${colorizedSeveritySymbol(severity)} ${ux.colorize(SEVERITY_COLORS[severity], severity)}: ${ux.colorize('underline', key)} (${group.filter((execution) => execution.status.kind !== 'passed').length})`;
};

/** `severity`: the severity symbol, then the pluralized severity word. */
const severityHeading: RenderGroupHeadingFn<Groupable> = (key, group) => {
  const count = group.filter(
    (execution) => execution.status.kind !== 'passed',
  ).length;
  const label = ux.colorize('underline', pluralizeSeverity(key).toUpperCase());
  // Keys here are always severity words or the `skipped` bucket; `skipped` has
  // a symbol but no severity color, so it is rendered uncolored.
  const heading =
    key === 'skipped'
      ? `${SEVERITY_SYMBOLS.skipped} ${label}`
      : ux.colorize(
          SEVERITY_COLORS[key as Severity],
          `${SEVERITY_SYMBOLS[key as Severity]} ${label}`,
        );
  return `${heading} (${count})`;
};

function colorizedSeveritySymbol(severity: Severity): string {
  return ux.colorize(SEVERITY_COLORS[severity], SEVERITY_SYMBOLS[severity]);
}

/** Best-effort heading severity when no rule descriptor resolves one. */
function groupSeverity(
  group: Groupable[],
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
): Severity {
  for (const execution of group) {
    const severity = resolveExecutionSeverity(execution, ruleIndex);
    if (severity !== undefined) {
      return severity;
    }
  }
  return 'error';
}

// --- Entry renderers -------------------------------------------------------

/**
 * `endpoint` entry: the historical layout — a status line, the rule id, then
 * the finding/step details. Kept byte-identical to the pre-flag output.
 */
function endpointEntryRenderer<T extends Groupable>(
  renderDetails: RenderExecutionDetailsFn<T>,
): RenderExecutionEntryFn<T> {
  return (
    execution,
    indentationLevel,
    { ruleIndex, locationResolver, toolRun },
  ) => {
    const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
    const severity = resolveExecutionSeverity(execution, ruleIndex) ?? 'error';
    const statusLine = renderStatus(
      execution.status,
      severity,
      rule?.summary?.text ?? rule?.description?.text ?? rule?.name,
    );

    const lines = [indent(indentationLevel) + statusLine];

    // The rule id is only rendered when we have the resolved descriptor,
    // because `rule` is itself looked up from `execution.ruleId` via the rule
    // index. If the descriptor is missing, `rule.id` and `execution.ruleId`
    // would be identical, so guarding on `rule` hides no identifying info.
    if (rule) {
      lines.push(
        indent(indentationLevel + 5) + ux.colorize('dim', '› ' + rule.id),
      );
    }

    lines.push(
      ...renderDetails(
        execution,
        indentationLevel + 6,
        locationResolver,
        toolRun,
      ),
    );

    return lines;
  };
}

/**
 * `rule`/`severity` entry: the group heading already carries the rule or
 * severity, so each violation leads with its location (the identity endpoint
 * grouping used to supply) and the reason. Under severity grouping it also
 * names the violated rule. Skipped executions are marked with the skip glyph.
 */
function groupedEntryRenderer<T extends Groupable>(
  renderDetails: RenderExecutionDetailsFn<T>,
  options: {
    labelOf: (
      execution: T,
      locationResolver: LocationResolver,
      toolRun: ToolRun,
    ) => string;
    showRule: boolean;
  },
): RenderExecutionEntryFn<T> {
  return (
    execution,
    indentationLevel,
    { ruleIndex, locationResolver, toolRun },
  ) => {
    const label = options.labelOf(execution, locationResolver, toolRun);
    const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
    const severity =
      resolveExecutionSeverity(execution, ruleIndex) ??
      (execution.status.kind === 'skipped' ? 'skipped' : 'error');
    const symbol =
      severity === 'skipped' ? SEVERITY_SYMBOLS['skipped'] + '  skipped:' : '•';

    const reason =
      'reason' in execution.status ? execution.status.reason : undefined;
    const message = reason ?? rule?.summary?.text ?? rule?.description?.text;

    const ruleRef =
      options.showRule && rule ? ` ${ux.colorize('dim', '› ' + rule.id)}` : '';

    let detailIndentionLevel = indentationLevel + 1;

    const lines = [`${indent(indentationLevel)}${symbol} ${label}`];

    if (message) {
      lines.push(indent(indentationLevel + 1) + '➜ ' + message);
      // if we print a message we must increase the indentation of the details
      detailIndentionLevel++;
    }

    if (options.showRule && ruleRef) {
      lines.push(indent(indentationLevel + 1) + ruleRef);
    }

    lines.push(
      ...renderDetails(
        execution,
        detailIndentionLevel,
        locationResolver,
        toolRun,
      ),
    );

    return lines;
  };
}
