import { ux } from '@oclif/core';
import {
  type AnalyzeExecution,
  type LintExecution,
  type LocationResolver,
  resolveExecutionSeverity,
  type RuleDescriptor,
  type TestCaseExecution,
  type ToolRun,
} from '@thymian/core';

import { renderStatus } from './status.js';
import { indent, sortRecordByKey } from './utils.js';

export type GroupExecutionsFn<
  T extends LintExecution | TestCaseExecution | AnalyzeExecution,
> = (execution: T) => string;

export type RenderExecutionDetailsFn<
  T extends LintExecution | TestCaseExecution | AnalyzeExecution,
> = (
  execution: T,
  indentationLevel: number,
  locationResolver: LocationResolver,
  toolRun: ToolRun,
) => string[];

export type RenderExecutionForRun<
  T extends LintExecution | TestCaseExecution | AnalyzeExecution,
> = (
  executions: T[],
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  locationResolver: LocationResolver,
  toolRun: ToolRun,
) => string[];

export function createExecutionsRenderer<
  T extends LintExecution | TestCaseExecution | AnalyzeExecution,
>(
  groupBy: GroupExecutionsFn<T>,
  renderExecution: RenderExecutionDetailsFn<T>,
  indentationLevel: number,
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
    for (const [name, group] of Object.entries(sortRecordByKey(groups))) {
      if (!group.some((execution) => execution.status.kind !== 'passed')) {
        continue;
      }

      lines.push(indent(indentationLevel) + ux.colorize('underline', name));
      lines.push('');

      for (const execution of group) {
        if (execution.status.kind === 'passed') {
          continue;
        }

        const rule = execution.ruleId
          ? ruleIndex.get(execution.ruleId)
          : undefined;
        const severity =
          resolveExecutionSeverity(execution, ruleIndex) ?? 'error';
        const statusLine = renderStatus(
          execution.status,
          severity,
          rule?.summary?.text ?? rule?.description?.text ?? rule?.name,
        );

        lines.push(indent(indentationLevel + 1) + statusLine);

        // The rule id is only rendered when we have the resolved descriptor,
        // because `rule` is itself looked up from `execution.ruleId` via the
        // rule index. If the descriptor is missing, `rule.id` and
        // `execution.ruleId` would be identical, so guarding on `rule` does not
        // hide any additional identifying information.
        if (rule) {
          lines.push(
            indent(indentationLevel + 6) + ux.colorize('dim', '› ' + rule.id),
          );
        }

        lines.push(
          ...renderExecution(
            execution,
            indentationLevel + 7,
            locationResolver,
            toolRun,
          ),
        );

        lines.push('');
      }
    }

    return lines;
  };
}
