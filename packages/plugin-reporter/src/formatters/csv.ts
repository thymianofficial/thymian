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

import type {
  FileFormatterOptions,
  Formatter,
  FormatterRuntimeOptions,
} from '../formatter.js';
import { resolveReportPath } from '../report-file-name.js';

const CSV_HEADER =
  'run_id,run_type,tool,rule_id,location,row_type,status,severity,finding_kind,finding_id,title,message,detail\n';

export type CsvFormatterOptions = FileFormatterOptions;

function executionLabel(
  execution: Execution,
  resolveLocation: LocationResolver,
  runVersion: string | undefined,
): string {
  return execution.kind === 'test'
    ? execution.name
    : resolveLocation(execution.location, runVersion);
}

/**
 * One open destination: the stream plus where it points, and whether it has
 * already failed. Errors past `ready` can only be logged, so `failed` keeps a
 * later success message from claiming a file that was never fully written.
 */
type OpenCsvStream = {
  stream: WriteStream;
  outputPath: string;
  failed: boolean;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class CsvFormatter implements Formatter<CsvFormatterOptions> {
  options!: CsvFormatterOptions & FormatterRuntimeOptions;

  /**
   * Content of the most recently written report, handed back by {@link flush}
   * so a caller that drives a single report still gets the rendered output.
   */
  private lastOutput: string | undefined;

  /**
   * Tail of the write chain. `core.report` is emitted fire-and-forget — the
   * emitter never awaits its subscribers — so without this a `flush()` during
   * `core.close` could return before a report reached disk, and `serve` calls
   * `process.exit()` right after. Serializing on one chain is also what lets
   * {@link write} keep its stream in a local: only one write is ever in
   * flight, so there is no shared stream for two reports to fight over.
   */
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly logger: Logger) {}

  init(options: CsvFormatterOptions & FormatterRuntimeOptions): void {
    this.options = options;
  }

  async report(report: Report): Promise<void> {
    const task = this.queue.then(async () => this.write(report));

    // Keep the chain alive even if this write rejects, so one failure cannot
    // poison every later report.
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  /**
   * Awaits every write started so far and hands back the last report's content.
   * Never throws: it runs inside the `core.close` action handler, and a
   * destination that could not be written must not take the shutdown with it.
   */
  async flush(): Promise<string | undefined> {
    await this.queue;

    return this.lastOutput;
  }

  /**
   * Render and persist one report. Never throws.
   *
   * The stream is a local, not instance state: {@link report} serializes calls,
   * so exactly one write is in flight and nothing else can close or overwrite
   * this stream mid-flight.
   */
  private async write(report: Report): Promise<void> {
    const outputPath = resolveReportPath(
      this.options.cwd ?? process.cwd(),
      this.options.reportsDir,
      report,
      'csv',
    );

    // Open — and therefore write the header — before rendering, so a report
    // that produces no rows still leaves a header-only file behind.
    const open = await this.openStream(outputPath);

    // Destination unusable (already logged): drop the report instead of
    // throwing, so one broken destination cannot fail the whole run and the
    // next report still gets its own attempt.
    if (open === undefined) {
      return;
    }

    let written: string | undefined;

    try {
      // Rendering is inside the guard too: a malformed report must degrade
      // exactly like an unwritable destination rather than reject out of
      // `report()` — and must not leave this stream open on its way out.
      const rows = reportToCsvLines(report).join('');

      if (rows.length === 0 || (await writeRows(open.stream, rows))) {
        written = rows;
      }
    } catch (err) {
      this.logger.error(
        `Failed to write CSV report to ${outputPath}: ${errorMessage(
          err,
        )}. No CSV report will be written for this report.`,
      );
    } finally {
      await closeStream(open);
    }

    // Only claim — and only announce — content that actually reached disk.
    // `open.failed` is the flag the stream's own error listener sets, and it is
    // only reliable once the stream has been ended: an async write error (a
    // failed header, say) surfaces after `stream.write` has already returned.
    if (written !== undefined && !open.failed) {
      this.logger.debug(`Wrote CSV report to ${open.outputPath}`);
      this.lastOutput = `${CSV_HEADER}${written}`;
    }
  }

  /**
   * Create the run directory and open the stream with the CSV header already
   * written.
   *
   * Never rejects. A destination we cannot create (EACCES, ENOTDIR, ENOSPC, a
   * read-only filesystem …) is logged once and yields `undefined`, which leaves
   * this report unwritten but the formatter usable for the next one. A rejection
   * here would instead be re-raised by `report()`, which runs inside the
   * `core.report` handler — one unwritable report file would take the whole run
   * down with it.
   */
  private async openStream(
    outputPath: string,
  ): Promise<OpenCsvStream | undefined> {
    try {
      await mkdir(dirname(outputPath), { recursive: true });

      const stream = createWriteStream(outputPath, 'utf-8');
      const open: OpenCsvStream = { stream, outputPath, failed: false };

      return await new Promise<OpenCsvStream>((resolve, reject) => {
        // The `catch` below owns the logging for this leg, so `onError` only
        // has to reject.
        const onError = (err: Error) => {
          reject(err);
        };

        stream.once('error', onError);

        stream.on('ready', () => {
          stream.removeListener('error', onError);
          // Past `ready` there is nobody left to reject to, so a write error
          // can only be recorded and reported.
          stream.on('error', (err) => {
            open.failed = true;
            this.logger.error(
              `Failed to write CSV report to ${outputPath}: ${err.message}`,
            );
          });

          stream.write(CSV_HEADER);

          resolve(open);
        });
      });
    } catch (err) {
      this.logger.error(
        `Failed to write CSV report to ${outputPath}: ${errorMessage(
          err,
        )}. No CSV report will be written for this report.`,
      );

      return undefined;
    }
  }
}

/** End a stream and never reject. */
function closeStream(open: OpenCsvStream): Promise<void> {
  return new Promise<void>((resolve) => {
    // Write errors are already logged by the listener installed in
    // `openStream`, so closing only ever resolves.
    open.stream.once('error', () => {
      resolve();
    });
    open.stream.end(() => {
      resolve();
    });
  });
}

/**
 * Write the rendered rows, reporting success rather than rejecting: a failure is
 * already logged by the stream's error listener, and `report()` must not throw.
 */
function writeRows(stream: WriteStream, rows: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    stream.write(rows, (err) => {
      resolve(!err);
    });
  });
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
