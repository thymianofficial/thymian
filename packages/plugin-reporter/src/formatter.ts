import { collectFindings, type Report, type Severity } from '@thymian/core';

export type ThymianReportStatistics = {
  numberOfReports: number;
  numberOfRuns: number;
  numberOfFindings: number;
  severityCounts: Record<Severity, number>;
  /** Number of findings per `kind`, collected recursively across the tree. */
  kindCounts: Record<string, number>;
};

export type ReportAnalysis = {
  statistics: ThymianReportStatistics;
};

export function analyze(reports: Report[]): ReportAnalysis {
  const severityCounts: Record<Severity, number> = {
    error: 0,
    warn: 0,
    hint: 0,
    info: 0,
  };
  const kindCounts: Record<string, number> = {};

  let runCounter = 0;
  let findingsCounter = 0;

  for (const report of reports) {
    runCounter += report.runs.length;

    for (const run of report.runs) {
      for (const finding of collectFindings(run.executions, {
        includeNested: true,
      })) {
        findingsCounter += 1;
        severityCounts[finding.severity] += 1;
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
      kindCounts,
    },
  };
}

export interface Formatter<Options = Record<PropertyKey, unknown>> {
  options: Options;

  init(options: Options): void | Promise<void>;

  report(report: Report): void | Promise<void>;

  flush(): string | undefined | Promise<string | undefined>;
}
