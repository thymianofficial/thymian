import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';
import chalk from 'chalk';

import {
  analyze,
  type Formatter,
  type ThymianReportStatistics,
} from '../formatter.js';
import { createList } from '../utils.js';

const header = `
+----------------+
|   CLI REPORT   |
+----------------+
`;

export function printProducer(producer: string): void {
  console.log(
    Array.from({ length: producer.length })
      .map(() => '-')
      .join(''),
  );
  console.log(chalk.bold(producer));
  console.log(
    Array.from({ length: producer.length })
      .map(() => '-')
      .join(''),
  );
  console.log();
}

export function createCliSummaryMessage(
  statistics: ThymianReportStatistics,
): string {
  let message = `Found ${statistics.numberOfReports} reports from ${Object.keys(statistics.reportsFromProducers).length} producers. `;

  message +=
    createList(
      Object.entries(statistics.reportsFromProducers).map(
        ([producer, count]) =>
          `${chalk.bold(count)} reports from ${chalk.bold(producer)}`,
      ),
    ) + '.';

  return message;
}

export function mapSeverityToMessagePrefix(
  severity: ThymianReportSeverity,
): string {
  if (severity === 'hint') return `${chalk.blue(severity)}: `;
  if (severity === 'warn') return `${chalk.yellow(severity)}: `;
  if (severity === 'error') return `${chalk.red(severity)}: `;
  return '';
}

export type CliFormatterOptions = {
  summaryOnly: boolean;
};

export class CliFormatter implements Formatter<Partial<CliFormatterOptions>> {
  options!: CliFormatterOptions;

  private readonly reports: ThymianReport[] = [];

  init(options: Partial<CliFormatterOptions>): void {
    this.options = {
      summaryOnly: false,
      ...options,
    };
  }

  flush(): void {
    if (this.reports.length === 0) {
      return;
    }
    const analysis = analyze(this.reports);

    console.log(chalk.bold(header));
    console.log(createCliSummaryMessage(analysis.statistics));
    console.log();
    console.log();

    if (!this.options.summaryOnly) {
      for (const [producer, categories] of Object.entries(
        analysis.normalized,
      )) {
        printProducer(producer);

        console.group();

        if (Object.hasOwn(categories, 'No Category')) {
          for (const [title, reports] of Object.entries(
            categories['No Category'] ?? {},
          )) {
            console.log(chalk.bold(title));

            console.group();

            for (const report of reports) {
              console.log(
                `${mapSeverityToMessagePrefix(report.severity)}${report.summary}${report.source ? `\n   ${chalk.dim(report.source)}` : ''}`,
              );
              console.log();
            }

            console.groupEnd();
          }
        }

        for (const [category, titles] of Object.entries(categories)) {
          if (category === 'No Category') continue;

          console.log(chalk.bold(category));

          console.group();

          console.log();

          for (const [title, reports] of Object.entries(titles)) {
            console.log(chalk.underline(title));

            console.group();

            for (const report of reports) {
              console.log(
                `${mapSeverityToMessagePrefix(report.severity)}${report.summary}${report.source ? `\n   ${chalk.dim(report.source)}` : ''}`,
              );
              console.log();
            }

            console.groupEnd();
          }

          console.groupEnd();
        }

        console.groupEnd();
        console.log();
      }
    }

    console.log(
      `Found ${chalk.red(`${analysis.statistics.severityCounts.error} errors`)}, ${chalk.yellow(`${analysis.statistics.severityCounts.warn} warnings`)} and ${chalk.blue(`${analysis.statistics.severityCounts.hint} hints`)}.`,
    );
  }

  report(report: ThymianReport): void | Promise<void> {
    this.reports.push(report);
  }
}
