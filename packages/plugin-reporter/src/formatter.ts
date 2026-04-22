import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';

export type ThymianReportStatistics = {
  numberOfReports: number;
  numberOfItems: number;
  severityCounts: Record<ThymianReportSeverity, number>;
};

export type ReportAnalysis = {
  statistics: ThymianReportStatistics;
};

export function analyze(reports: Map<string, ThymianReport[]>): ReportAnalysis {
  const severityCounts: Record<ThymianReportSeverity, number> = {
    error: 0,
    warn: 0,
    hint: 0,
    info: 0,
  };

  let reportCounter = 0;
  let reportItemsCounter = 0;
  for (const [, r] of reports.entries()) {
    reportCounter += r.length;

    for (const report of r) {
      for (const section of report.sections ?? []) {
        reportItemsCounter += section.items.length;

        for (const item of section.items ?? []) {
          severityCounts[item.severity] =
            (severityCounts[item.severity] ?? 0) + 1;
        }
      }
    }
  }

  return {
    statistics: {
      numberOfReports: reportCounter,
      numberOfItems: reportItemsCounter,
      severityCounts,
    },
  };
}

export interface Formatter<Options = Record<PropertyKey, unknown>> {
  options: Options;

  init(options: Options): void | Promise<void>;

  report(report: ThymianReport): void | Promise<void>;

  flush(): string | undefined | Promise<string | undefined>;
}
