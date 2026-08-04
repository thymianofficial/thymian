import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Logger, Report } from '@thymian/core';

import type { Formatter } from '../formatter.js';

export type JsonFormatterOptions = {
  path: string;
};

/**
 * Machine-readable formatter that persists the canonical {@link Report} payload
 * verbatim. Unlike the markdown/CSV formatters it applies no grouping, sorting,
 * severity resolution, or location rendering — consumers get the same structure
 * core emitted on `core.report` and resolve `thymianFormat` locations themselves.
 *
 * The output is always a JSON array so a session that emits several reports stays
 * lossless, and it is written compactly because `Report.thymianFormat` embeds the
 * serialized format graph.
 */
export class JsonFormatter implements Formatter<JsonFormatterOptions> {
  options!: JsonFormatterOptions;

  private readonly reports: Report[] = [];

  constructor(private readonly logger: Logger) {}

  init(options: JsonFormatterOptions): void {
    this.options = options;
  }

  report(report: Report): void {
    this.reports.push(report);
  }

  async flush(): Promise<string | undefined> {
    if (this.reports.length === 0) {
      return undefined;
    }

    const output = JSON.stringify(this.reports);

    await mkdir(dirname(this.options.path), { recursive: true });
    await writeFile(this.options.path, output, 'utf-8');
    this.logger.debug(`Wrote JSON report to ${this.options.path}.`);

    return output;
  }
}
