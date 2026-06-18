import type { FindingRecord, Report, Severity } from '@thymian/core';

export type ThymianReportStatistics = {
  numberOfReports: number;
  numberOfRuns: number;
  numberOfFindings: number;
  severityCounts: Record<Severity, number>;
};

export type ReportAnalysis = {
  statistics: ThymianReportStatistics;
};

function collectFindings(report: Report): FindingRecord[] {
  const visit = (
    executions: Report['runs'][number]['executions'],
  ): FindingRecord[] =>
    (executions ?? []).flatMap((execution) => [
      ...execution.findings,
      ...visit(execution.children),
    ]);

  return report.runs.flatMap((run) => visit(run.executions));
}

export function analyze(reports: Report[]): ReportAnalysis {
  const severityCounts: Record<Severity, number> = {
    error: 0,
    warn: 0,
    hint: 0,
    info: 0,
  };

  let runCounter = 0;
  let findingsCounter = 0;

  for (const report of reports) {
    runCounter += report.runs.length;

    for (const finding of collectFindings(report)) {
      findingsCounter += 1;
      severityCounts[finding.severity] += 1;
    }
  }

  return {
    statistics: {
      numberOfReports: reports.length,
      numberOfRuns: runCounter,
      numberOfFindings: findingsCounter,
      severityCounts,
    },
  };
}

export interface Formatter<Options = Record<PropertyKey, unknown>> {
  options: Options;

  init(options: Options): void | Promise<void>;

  report(report: Report): void | Promise<void>;

  flush(): string | undefined | Promise<string | undefined>;
}
