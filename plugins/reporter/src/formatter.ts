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

export abstract class Formatter<Options = Record<PropertyKey, unknown>> {
  protected options!: Options;

  init(options: Options): this | Promise<this> {
    this.options = options;
    return this;
  }

  protected analyze(reports: ThymianReport[]): ReportAnalysis {
    return reports.reduce(
      (acc, report) => {
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
        normalized: {} as NormalizedThymianReports,
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
      } as ReportAnalysis,
    );
  }

  abstract report(report: ThymianReport): void | Promise<void>;

  abstract flush(final: boolean): void | Promise<void>;
}
