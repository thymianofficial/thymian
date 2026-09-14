import {
  buildRuleIndex,
  type Logger,
  type Report,
  resolveExecutionSeverity,
  type Severity,
  walkExecutions,
  walkFindings,
} from '@thymian/core';

/** Tallies of execution outcomes across a report. */
export type StatusCounts = Record<'passed' | 'failed' | 'skipped', number>;

export type ThymianReportStatistics = {
  numberOfReports: number;
  numberOfRuns: number;
  /** Number of detail findings (assertion/informational/rule-violation). */
  numberOfFindings: number;
  /**
   * Severity tallies. Counts each `failed` execution exactly once at its
   * resolved severity; detail findings carry no severity and are not counted.
   */
  severityCounts: Record<Severity, number>;
  /** Number of executions per outcome (`passed`/`failed`/`skipped`). */
  statusCounts: StatusCounts;
  /** Number of detail findings per `kind`. */
  kindCounts: Record<string, number>;
};

export type ReportAnalysis = {
  statistics: ThymianReportStatistics;
};

export function analyze(reports: Report[], logger?: Logger): ReportAnalysis {
  const severityCounts: Record<Severity, number> = {
    error: 0,
    warn: 0,
    hint: 0,
    info: 0,
  };
  const statusCounts: StatusCounts = { passed: 0, failed: 0, skipped: 0 };
  const kindCounts: Record<string, number> = {};

  let runCounter = 0;
  let findingsCounter = 0;

  for (const report of reports) {
    runCounter += report.runs.length;

    for (const run of report.runs) {
      const ruleIndex = buildRuleIndex(run.rules);

      for (const execution of walkExecutions(run.executions)) {
        statusCounts[execution.status.kind] += 1;

        const severity = resolveExecutionSeverity(execution, ruleIndex, logger);
        if (severity !== undefined) {
          severityCounts[severity] += 1;
        }
      }

      for (const { finding } of walkFindings(run.executions)) {
        findingsCounter += 1;
        kindCounts[finding.kind] = (kindCounts[finding.kind] ?? 0) + 1;
      }
    }
  }

  return {
    statistics: {
      numberOfReports: reports.length,
      numberOfRuns: runCounter,
      numberOfFindings: findingsCounter,
      severityCounts,
      statusCounts,
      kindCounts,
    },
  };
}

/**
 * User-facing configuration shared by every file formatter.
 *
 * Deliberately empty: where a formatter writes is not a per-formatter concern
 * any more. The plugin-level `reportsDir` option picks the base directory and
 * every report gets its own directory beneath it, so all formats of one run
 * stay together. This mirrors the reporter plugin's options schema one-to-one —
 * that schema is `additionalProperties: false` at every level, so nothing may be
 * added here that a user cannot set, and values the plugin injects belong in
 * {@link FormatterRuntimeOptions}.
 */
export type FileFormatterOptions = Record<never, never>;

/**
 * Values the reporter plugin injects into a formatter's `init`. Deliberately not
 * part of {@link FileFormatterOptions}: they are runtime context, not config,
 * and must never widen the user-facing options schema.
 */
export type FormatterRuntimeOptions = {
  /** Run directory a relative `reportsDir` is anchored to. */
  cwd?: string;
  /**
   * Base directory each report's own run directory is created under. Relative
   * to `cwd`; unset means `.thymian/reports`.
   */
  reportsDir?: string;
};

export interface Formatter<Options = Record<PropertyKey, unknown>> {
  options: Options;

  init(options: Options): void | Promise<void>;

  report(report: Report): void | Promise<void>;

  flush(): string | undefined | Promise<string | undefined>;
}
