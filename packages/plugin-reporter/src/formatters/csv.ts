import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Execution, Logger, Report } from '@thymian/core';
import {
  buildRuleIndex,
  createLocationResolver,
  findingDetails,
  type LocationResolver,
  resolveExecutionSeverity,
  walkExecutions,
} from '@thymian/core';

import type { Formatter } from '../formatter.js';

const CSV_HEADER =
  'run_id,run_type,tool,rule_id,location,row_type,status,severity,finding_kind,finding_id,title,message,detail\n';

export type CsvFormatterOptions = {
  path: string;
};

function executionLabel(
  execution: Execution,
  resolveLocation: LocationResolver,
  runVersion: string | undefined,
): string {
  return execution.kind === 'test'
    ? execution.name
    : resolveLocation(execution.location, runVersion);
}

export class CsvFormatter implements Formatter<CsvFormatterOptions> {
  private stream!: WriteStream;

  options!: CsvFormatterOptions;

  constructor(private readonly logger: Logger) {}

  flush(): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      this.stream.once('error', reject);
      this.stream.end(() => {
        this.stream.removeListener('error', reject);
        this.logger.debug(`Wrote CSV report to ${this.options.path}`);
        resolve(undefined);
      });
    });
  }

  async init(options: CsvFormatterOptions): Promise<void> {
    this.options = options;

    await mkdir(dirname(options.path), { recursive: true });

    this.stream = createWriteStream(options.path, 'utf-8');

    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.logger.error(
          `Failed to write CSV report to ${this.options.path}: ${err.message}`,
        );
        reject(err);
      };

      this.stream.once('error', onError);

      this.stream.on('ready', () => {
        this.stream.removeListener('error', onError);
        this.stream.on('error', (err) => {
          this.logger.error(
            `Failed to write CSV report to ${this.options.path}: ${err.message}`,
          );
        });

        this.stream.write(CSV_HEADER);

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
  const resolveLocation = createLocationResolver(report);

  for (const run of report.runs) {
    const ruleIndex = buildRuleIndex(run.rules);
    const runVersion = run.thymianFormatVersion;

    for (const execution of walkExecutions(run.executions)) {
      const ruleId = execution.ruleId ?? '';
      const status = execution.status;
      const severity = resolveExecutionSeverity(execution, ruleIndex);
      const reason = status.kind === 'passed' ? '' : (status.reason ?? '');
      const duration =
        status.kind !== 'skipped' && status.durationMilliseconds !== undefined
          ? `duration=${status.durationMilliseconds}ms`
          : '';
      const label = executionLabel(execution, resolveLocation, runVersion);

      // One row per execution so failed/skipped executions stay visible even
      // when they carry no detail findings.
      lines.push(
        `${csvSafe(run.runId)},${csvSafe(run.runType)},${csvSafe(run.tool.name)},${csvSafe(ruleId)},${csvSafe(label)},execution,${csvSafe(status.kind)},${csvSafe(severity)},,,,${csvSafe(reason)},${csvSafe(duration)}\n`,
      );

      const findingsWithLocation =
        execution.kind === 'test'
          ? execution.steps.flatMap((step) =>
              step.findings.map((finding) => ({
                finding,
                location: resolveLocation(step.location, runVersion),
              })),
            )
          : execution.findings.map((finding) => ({
              finding,
              location: resolveLocation(execution.location, runVersion),
            }));

      for (const { finding, location } of findingsWithLocation) {
        const detail = findingDetails(finding)
          .map((d) => `${d.label}=${d.value}`)
          .join('; ');
        lines.push(
          `${csvSafe(run.runId)},${csvSafe(run.runType)},${csvSafe(run.tool.name)},${csvSafe(ruleId)},${csvSafe(location)},finding,,,${csvSafe(finding.kind)},${csvSafe(finding.id)},${csvSafe(finding.title)},${csvSafe(finding.message?.text)},${csvSafe(detail)}\n`,
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
