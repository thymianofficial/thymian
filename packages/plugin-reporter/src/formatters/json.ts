import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Logger, Report } from '@thymian/core';

import type {
  FileFormatterOptions,
  Formatter,
  FormatterRuntimeOptions,
} from '../formatter.js';
import { resolveReportPath } from '../report-file-name.js';

export type JsonFormatterOptions = FileFormatterOptions;

/**
 * Machine-readable formatter that persists the canonical {@link Report} payload
 * verbatim. Unlike the markdown/CSV formatters it applies no grouping, sorting,
 * severity resolution, or location rendering — consumers get the same structure
 * core emitted on `core.report` and resolve `thymianFormat` locations themselves.
 *
 * Each report is written to its own run directory as soon as it arrives, so a
 * session that emits several reports produces several files rather than one
 * aggregate pinned to the first report. The payload is still a JSON array — of
 * exactly one report — so the shape consumers parse never changes, and it is
 * written compactly because `Report.thymianFormat` embeds the serialized format
 * graph.
 */
export class JsonFormatter implements Formatter<JsonFormatterOptions> {
  options!: JsonFormatterOptions & FormatterRuntimeOptions;

  /**
   * Output of the most recently written report, handed back by {@link flush} so
   * a caller that drives a single report still gets the rendered payload.
   *
   * No production consumer: the reporter plugin discards `flush()`'s return
   * value. It exists for the {@link Formatter} contract and for callers — tests
   * today — that drive one report and assert on the payload. Bounded to one
   * payload on purpose; retaining every report is what this formatter used to
   * do to emit a session-level array.
   */
  private lastOutput: string | undefined;

  /**
   * Tail of the write chain. `core.report` is emitted fire-and-forget — the
   * emitter never awaits its subscribers — so without this a `flush()` during
   * `core.close` could return before a report reached disk, and `serve` calls
   * `process.exit()` right after. Serializing on one chain also keeps two
   * overlapping reports from interleaving.
   */
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly logger: Logger) {}

  init(options: JsonFormatterOptions & FormatterRuntimeOptions): void {
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
   * Awaits every write started so far and hands back the last payload.
   *
   * Never throws: it runs inside the `core.close` action handler, and a
   * destination that could not be written must not take the shutdown with it.
   */
  async flush(): Promise<string | undefined> {
    await this.queue;

    return this.lastOutput;
  }

  /** Serialize and persist one report. Never throws. */
  private async write(report: Report): Promise<void> {
    const outputPath = resolveReportPath(
      this.options.cwd ?? process.cwd(),
      this.options.reportsDir,
      report,
      'json',
    );

    try {
      // Serialization is inside the guard too: a report carrying a circular
      // reference or a BigInt makes `JSON.stringify` throw, and that must
      // degrade exactly like an unwritable destination rather than reject out
      // of `report()`.
      const output = JSON.stringify([report]);

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, output, 'utf-8');
      this.logger.info(`Wrote JSON report to ${outputPath}.`);
      this.lastOutput = output;
    } catch (err) {
      // A destination we cannot create or write leaves this formatter inert for
      // that report: throwing here would abort the `core.report` handler and
      // take every other formatter — and the run — down with it.
      this.logger.error(
        `Failed to write JSON report to ${outputPath}: ${
          err instanceof Error ? err.message : String(err)
        }. No JSON report will be written for this report.`,
      );
    }
  }
}
