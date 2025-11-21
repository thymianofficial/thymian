import type { ThymianReport, ThymianSeverity } from '@thymian/core';
import chalk from 'chalk';
import { Table } from 'console-table-printer';

type Normalized = {
  producer: string;
  category?: string;
  ruleIdOrTitle: string;
  severity: ThymianSeverity;
  summary: string;
  details?: string;
};

function isProblemSeverity(severity: ThymianSeverity): boolean {
  return severity === 'warn' || severity === 'error';
}

function normalize(report: ThymianReport): Normalized {
  // Ableitung für Rückwärtskompatibilität
  const severity: ThymianSeverity = report.severity
    ? report.severity
    : report.isProblem
      ? 'error'
      : 'info';

  const producer = report.producer ?? report.topic ?? 'unknown';
  const category = report.category ?? report.subTopic;
  const ruleIdOrTitle = report.ruleId ?? report.title ?? 'Untitled';
  const summary = report.summary ?? report.text ?? ruleIdOrTitle;
  const details = report.details ?? report.text;

  return {
    producer,
    category: category ?? undefined,
    ruleIdOrTitle,
    severity,
    summary,
    details,
  };
}

type ReportRecord = Record<
  string,
  Record<string, Record<string, Normalized[]>>
>; // producer -> category -> rule/title

export function formatReports(reports: ThymianReport[]): ReportRecord {
  return reports.reduce((acc, r) => {
    const n = normalize(r);
    const producer = n.producer;
    const category = n.category ?? 'General';
    const key = n.ruleIdOrTitle;

    acc[producer] = acc[producer] ?? {};
    acc[producer][category] = acc[producer][category] ?? {};
    acc[producer][category][key] = acc[producer][category][key] ?? [];
    acc[producer][category][key].push(n);
    return acc;
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
  } else if (
    !thymianReports.some((r) => isProblemSeverity(normalize(r).severity))
  ) {
    console.log(chalk.green('No problems were found.'));

    return;
  }

  const numberOfProblems = thymianReports.filter((r) =>
    isProblemSeverity(normalize(r).severity),
  ).length;
  const formattedReports = formatReports(thymianReports);
  const table = new Table();

  console.log(chalk.bold(header));

  for (const [producer, categories] of Object.entries(formattedReports)) {
    let problemCounter = 0;

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
    console.group();

    for (const [category, byRule] of Object.entries(categories)) {
      console.log(chalk.bold(category));
      console.log();

      console.group();

      for (const [title, reports] of Object.entries(byRule)) {
        problemCounter += reports.filter((r) =>
          isProblemSeverity(r.severity),
        ).length;

        console.log(chalk.underline(title));
        console.group();

        for (const r of reports) {
          const msg = r.details ?? r.summary;
          const prefix = r.severity.toUpperCase().padEnd(5, ' ');
          console.log(`${prefix} ${msg}`);
        }

        console.log();
        console.groupEnd();
      }

      console.groupEnd();
      console.log();
    }

    console.groupEnd();
    console.log();

    table.addRow({
      Topic: producer,
      '# of Problems': problemCounter,
    });
  }

  table.addRow(
    {
      Topic: 'Total Number',
      '# of Problems': numberOfProblems,
    },
    { color: 'red' },
  );
  // Table or single line output?
  table.printTable();
  // console.log(
  //   chalk.red(`${chalk.bold(numberOfProblems)} problems were found.`)
  // );
}
