import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';

export type Producer = string;
export type Category = 'No Category' | string;
export type Title = string;

export type NormalizedThymianReports = Record<
  Producer,
  Record<Category, Record<Title, ThymianReport[]>>
>;

export type ThymianReportStatistics = {
  numberOfReports: number;
  severityCounts: Record<ThymianReportSeverity, number>;
  reportsFromProducers: Record<Producer, number>;
};

export type ReportAnalysis = {
  normalized: NormalizedThymianReports;
  statistics: ThymianReportStatistics;
};

export function analyze(reports: ThymianReport[]): ReportAnalysis {
  return reports.reduce(
    (acc: ReportAnalysis, report) => {
      const { producer, category = 'No Category', title } = report;

      acc.statistics.reportsFromProducers[producer] ??= 0;
      acc.statistics.reportsFromProducers[producer]++;

      acc.normalized[producer] ??= {};
      acc.normalized[producer][category] ??= {};
      acc.normalized[producer][category][title] ??= [];
      acc.normalized[producer][category][title].push(report);

      acc.statistics.severityCounts[report.severity]++;

      return acc;
    },
    {
      normalized: {},
      statistics: {
        numberOfReports: reports.length,
        severityCounts: {
          error: 0,
          warn: 0,
          hint: 0,
          info: 0,
        },
        reportsFromProducers: {},
      },
    },
  );
}

export interface Formatter<Options = Record<PropertyKey, unknown>> {
  options: Options;

  init(options: Options): void | Promise<void>;

  report(report: ThymianReport): void | Promise<void>;

  flush(): void | Promise<void>;
}
