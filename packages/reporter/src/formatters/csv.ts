import { createWriteStream, type WriteStream } from 'node:fs';

import type { Logger, ThymianReport } from '@thymian/core';

import type { Formatter } from '../formatter.js';

export type CsvFormatterOptions = {
  path: string;
  logger: Logger;
};

export class CsvFormatter implements Formatter<CsvFormatterOptions> {
  private stream!: WriteStream;

  options!: CsvFormatterOptions;

  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.end(() => {
        this.options.logger.debug(`Wrote CSV report to ${this.options.path}`);

        resolve();
      });
    });
  }

  init(options: CsvFormatterOptions): Promise<void> {
    this.options = options;
    this.stream = createWriteStream(options.path, 'utf-8');

    this.stream.on('error', (err) => {
      this.options.logger.error(
        `Failed to write CSV report to ${this.options.path}: ${err.message}`,
      );
    });

    return new Promise((resolve) => {
      this.stream.on('ready', () => {
        this.stream.write('producer,severity,title,summary,category,source\n');

        resolve();
      });
    });
  }

  report(report: ThymianReport): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.write(thymianReportToCsvLine(report), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export function thymianReportToCsvLine(report: ThymianReport): string {
  return `${makeStringCsvSafe(report.producer)},${makeStringCsvSafe(report.severity)},${makeStringCsvSafe(report.title)},${makeStringCsvSafe(report.summary)},${makeStringCsvSafe(report.category)},${makeStringCsvSafe(report.source)}\n`;
}

export function makeStringCsvSafe(str: string | undefined): string | null {
  return str ? `"${str.replaceAll('\n', ' ')}"` : null;
}
