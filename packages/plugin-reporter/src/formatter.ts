import type {
  ThymianReport,
  ThymianReportItem,
  ThymianReportSeverity,
} from '@thymian/core';

export type ThymianReportStatistics = {
  numberOfReports: number;
  numberOfItems: number;
  severityCounts: Record<ThymianReportSeverity, number>;
};

export type ReportAnalysis = {
  reports: ThymianReport[];
  statistics: ThymianReportStatistics;
};

function countItems(reports: ThymianReport[]): ThymianReportItem[] {
  return reports.flatMap(
    (report) => report.sections?.flatMap((s) => s.items) ?? [],
  );
}

export function analyze(reports: ThymianReport[]): ReportAnalysis {
  const items = countItems(reports);

  const severityCounts: Record<ThymianReportSeverity, number> = {
    error: 0,
    warn: 0,
    hint: 0,
    info: 0,
  };

  for (const item of items) {
    severityCounts[item.severity]++;
  }

  return {
    reports,
    statistics: {
      numberOfReports: reports.length,
      numberOfItems: items.length,
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
