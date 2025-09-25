import type { ThymianReport } from '@thymian/core';
import chalk from 'chalk';
import { Table } from 'console-table-printer';
import * as fs from 'fs';
import * as process from 'node:process';

import { existsSync } from 'fs';

type ReportRecord = Record<
  string,
  Record<string, ThymianReport[] | Record<string, ThymianReport[]>>
>;

const outputFolder = `${process.cwd()}/output`;


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

export async function mdReport(thymianReports: ThymianReport[]): Promise<void> {
  let fileContent = '# CLI Report';

  if (thymianReports.length === 0) {
    return;
  } else if (!thymianReports.some((r) => r.isProblem)) {
    console.log(chalk.green('No problems were found.'));

    return;
  }

  const numberOfProblems = thymianReports.filter((r) => r.isProblem).length;
  const formattedReports = formatReports(thymianReports);

  for (const [topic, titles] of Object.entries(formattedReports)) {
    let problemCounter = 0;
    fileContent = addLines(fileContent, 1,  `## ${topic}`);

    for (const [titleOrSubtopic, reportsOrNested] of Object.entries(titles)) {
      fileContent = addLines(fileContent, 1,  `### ${titleOrSubtopic}`);

      if (Array.isArray(reportsOrNested)) {
        for (const report of reportsOrNested) {
          if (report.isProblem) {
            problemCounter++;
          }

          fileContent = addLines(fileContent, 1,  `> ${report.text}`);
        }
      } else {
        for (const [title, reports] of Object.entries(reportsOrNested)) {
          problemCounter += reports.filter((r) => r.isProblem).length;
          fileContent = addLines(fileContent, 1,  `#### ${title}`);

          for (const report of reports) {
            fileContent = addLines(fileContent, 1,  `> ${report.text}`);
          }
        }
      }
    }

    fileContent = addLines(fileContent, 3,  `## ${topic}`);
    fileContent = addLines(fileContent, 1,  `## # of Problems: ${problemCounter}`);
  }


  fileContent = addLines(fileContent, 3,  `## Total Number`);
  fileContent = addLines(fileContent, 1,  `## # of Problems: ${numberOfProblems}`);


  try {
    const timestamp = new Date().getTime();
    if(!existsSync(outputFolder)) {
      await fs.promises.mkdir(outputFolder, { recursive: true });
    }

    await fs.promises.writeFile(`${outputFolder}/${timestamp}_report.md`, fileContent, {
      mode: 0o777,
      encoding: 'utf-8',
    });
  } catch (error) {
    console.log('ERROR WRITING FILE: ', error);
  }
}


function addLines(content: string, spaceLines: number, newContent: string): string {
  return content.concat('\n'.repeat(spaceLines)).concat(newContent);
}
