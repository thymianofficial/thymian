import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import type { Report } from '@thymian/core';
import {
  ajv,
  formatAjvErrors,
  reportSchema,
  ThymianBaseError,
} from '@thymian/core';

/**
 * Reads a persisted Thymian JSON report file and returns its reports.
 *
 * Accepts both this package's JSON formatter's native output (an **array** of
 * reports — a session can emit several) and a bare single `Report` object.
 * Each report is validated structurally against the loose `reportSchema`
 * (`additionalProperties: true` — the persisted-report compatibility
 * contract), never strict-parsed, so reports written by newer or older
 * Thymian versions stay readable as long as the core shape holds.
 *
 * @param inputLabel the offending input's identity (`type:location`), used in
 *   every error message so failures trace back to the CLI input.
 * @throws {ThymianBaseError} if the file is unreadable, not valid JSON, not a
 *   report object/array, an empty array, or an entry fails `reportSchema`.
 */
export async function loadThymianReports(
  location: string,
  inputLabel: string,
  cwd: string,
): Promise<Report[]> {
  const filePath = isAbsolute(location) ? location : join(cwd, location);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ThymianBaseError(
      `Failed to read Thymian report "${inputLabel}" (resolved to ${filePath}).`,
      { cause: err instanceof Error ? err : undefined },
    );
  }

  let parsed: unknown;
  try {
    // Tolerate a UTF-8 BOM (common for files saved by Windows editors) —
    // JSON.parse rejects it with a misleading syntax error otherwise.
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new ThymianBaseError(
      `Failed to parse Thymian report "${inputLabel}" as JSON.`,
      { cause: err instanceof Error ? err : undefined },
    );
  }

  const candidates = Array.isArray(parsed) ? parsed : [parsed];

  if (candidates.length === 0) {
    throw new ThymianBaseError(
      `Unsupported Thymian report "${inputLabel}": the report array is empty — nothing to merge.`,
    );
  }

  const reports: Report[] = [];

  for (const [index, candidate] of candidates.entries()) {
    if (!ajv.validate(reportSchema, candidate)) {
      const { message } = formatAjvErrors(ajv.errors);
      const position = Array.isArray(parsed)
        ? ` (array entry ${index.toString()})`
        : '';
      throw new ThymianBaseError(
        `Unsupported Thymian report "${inputLabel}"${position}: not a valid Thymian JSON report. ${message}`,
      );
    }

    reports.push(candidate);
  }

  return reports;
}
