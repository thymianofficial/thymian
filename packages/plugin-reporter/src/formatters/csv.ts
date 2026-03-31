import { createWriteStream, type WriteStream } from 'node:fs';

import type { Logger, ThymianReport } from '@thymian/core';

import type { Formatter } from '../formatter.js';

export type CsvFormatterOptions = {
  path: string;
};

export class CsvFormatter implements Formatter<CsvFormatterOptions> {
  private stream!: WriteStream;

  options!: CsvFormatterOptions;

  constructor(private readonly logger: Logger) {}

  flush(): Promise<string | undefined> {
    return new Promise((resolve) => {
      this.stream.end(() => {
        this.logger.debug(`Wrote CSV report to ${this.options.path}`);

        resolve(undefined);
      });
    });
  }

  init(options: CsvFormatterOptions): Promise<void> {
    this.options = options;
    this.stream = createWriteStream(options.path, 'utf-8');

    this.stream.on('error', (err) => {
      this.logger.error(
        `Failed to write CSV report to ${this.options.path}: ${err.message}`,
      );
    });

    return new Promise((resolve) => {
      this.stream.on('ready', () => {
        this.stream.write('source,section,severity,ruleName,message,details\n');

        resolve();
      });
    });
  }

  report(report: ThymianReport): Promise<void> {
    return new Promise((resolve, reject) => {
      const lines = thymianReportToCsvLines(report);

      if (lines.length === 0) {
        resolve();
        return;
      }

      const data = lines.join('');
      this.stream.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export function thymianReportToCsvLines(report: ThymianReport): string[] {
  const lines: string[] = [];

  if (!report.sections || report.sections.length === 0) {
    // Report with no sections — emit a single row with source and message
    lines.push(`${csvSafe(report.source)},,,,,${csvSafe(report.message)}\n`);
    return lines;
  }

  for (const section of report.sections) {
    for (const item of section.items) {
      lines.push(
        `${csvSafe(report.source)},${csvSafe(section.heading)},${csvSafe(item.severity)},${csvSafe(item.ruleName)},${csvSafe(item.message)},${csvSafe(item.details)}\n`,
      );
    }
  }

  return lines;
}

export function csvSafe(str: string | undefined): string {
  if (!str) {
    return '';
  }

  // Escape double quotes by doubling them, wrap in quotes if needed
  const escaped = str.replaceAll('"', '""').replaceAll('\n', ' ');

  if (escaped.includes(',') || escaped.includes('"') || escaped.includes(' ')) {
    return `"${escaped}"`;
  }

  return escaped;
}
