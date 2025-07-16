import type { ThymianReport } from '@thymian/core';
import chalk from 'chalk';
import { Table } from 'console-table-printer';

type ReportRecord = Record<
  string,
  Record<string, ThymianReport[] | Record<string, ThymianReport[]>>
>;

export function formatReports(reports: ThymianReport[]): ReportRecord {
  return reports.reduce((reportAccumulator, currentReport) => {
    const { topic, title, subTopic } = currentReport;

    if (!reportAccumulator[topic]) {
      reportAccumulator[topic] = {};
    }

    if (subTopic) {
      if (!reportAccumulator[topic][subTopic]) {
        reportAccumulator[topic][subTopic] = {};
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      if (!reportAccumulator[topic][subTopic][title]) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        reportAccumulator[topic][subTopic][title] = [];
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      reportAccumulator[topic][subTopic][title].push(currentReport);
    } else {
      if (!reportAccumulator[topic][title]) {
        reportAccumulator[topic][title] = [];
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      reportAccumulator[topic][title].push(currentReport);
    }

    return reportAccumulator;
  }, {} as ReportRecord);
}

const header = `
+----------------+
|   CLI REPORT   |
+----------------+
`;

export function report(thymianReports: ThymianReport[]): void {
  if (thymianReports.length === 0) {
    return;
  }

  const numberOfProblems = thymianReports.filter((r) => r.isProblem).length;
  const formattedReports = formatReports(thymianReports);
  const table = new Table();

  console.log(chalk.bold(header));

  for (const [topic, titles] of Object.entries(formattedReports)) {
    let problemCounter = 0;

    console.log(
      Array.from({ length: topic.length })
        .map(() => '-')
        .join('')
    );
    console.log(chalk.bold(topic));
    console.log(
      Array.from({ length: topic.length })
        .map(() => '-')
        .join('')
    );
    console.log();
    console.group();

    for (const [titleOrSubtopic, reportsOrNested] of Object.entries(titles)) {
      console.log(chalk.bold(titleOrSubtopic));
      console.log();

      console.group();

      if (Array.isArray(reportsOrNested)) {
        for (const report of reportsOrNested) {
          if (report.isProblem) {
            problemCounter++;
          }
          console.log(report.text);
        }
        console.log();
      } else {
        for (const [title, reports] of Object.entries(reportsOrNested)) {
          problemCounter += reports.filter((r) => r.isProblem).length;

          console.log(chalk.underline(title));
          console.group();

          for (const report of reports) {
            console.log(report.text);
          }

          console.log();
          console.groupEnd();
        }
      }

      console.groupEnd();
      console.log();
    }

    console.groupEnd();
    console.log();

    table.addRow({
      Topic: topic,
      '# of Problems': problemCounter,
    });
  }

  table.addRow(
    {
      Topic: 'Total Number',
      '# of Problems': numberOfProblems,
    },
    { color: 'red' }
  );
  table.printTable();
}
