import { createWriteStream, type WriteStream } from 'node:fs';

import type { Logger, Report } from '@thymian/core';

import type { Formatter } from '../formatter.js';

export type CsvFormatterOptions = {
  path: string;
};

function formatLocation(
  location: NonNullable<
    Report['runs'][number]['executions']
  >[number]['location'],
): string {
  switch (location.type) {
    case 'custom':
      return location.value;
    case 'file':
      return [location.path, location.line, location.column]
        .filter((part) => part !== undefined)
        .join(':');
    case 'url':
      return location.url;
    case 'thymianFormat':
      return `format:${location.elementId}${location.pointer ? `#${location.pointer}` : ''}`;
  }
}

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
        this.stream.write(
          'run_id,run_type,tool,execution_location,finding_kind,finding_id,severity,title,message,rule_id\n',
        );

        resolve();
      });
    });
  }

  report(report: Report): Promise<void> {
    return new Promise((resolve, reject) => {
      const lines = reportToCsvLines(report);

      if (lines.length === 0) {
        resolve();
        return;
      }

      this.stream.write(lines.join(''), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export function reportToCsvLines(report: Report): string[] {
  const lines: string[] = [];

  for (const run of report.runs) {
    for (const execution of run.executions ?? []) {
      for (const finding of execution.findings) {
        lines.push(
          `${csvSafe(run.runId)},${csvSafe(run.runType)},${csvSafe(run.tool.name)},${csvSafe(formatLocation(execution.location))},${csvSafe(finding.kind)},${csvSafe(finding.id)},${csvSafe(finding.severity)},${csvSafe(finding.title)},${csvSafe(finding.message?.text)},${csvSafe('ruleId' in finding ? finding.ruleId : undefined)}\n`,
        );
      }
    }
  }

  return lines;
}

export function csvSafe(str: string | undefined): string {
  if (!str) {
    return '';
  }

  const escaped = str.replaceAll('"', '""').replaceAll('\n', ' ');

  if (escaped.includes(',') || escaped.includes('"') || escaped.includes(' ')) {
    return `"${escaped}"`;
  }

  return escaped;
}
