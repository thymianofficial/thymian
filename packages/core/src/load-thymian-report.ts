import { ajv, formatAjvErrors } from './ajv.js';
import { reportSchema } from './events/index.js';
import type { Report } from './report/index.js';
import { readTypedInputJson } from './report-input-claim.js';
import { ThymianBaseError } from './thymian.error.js';

/**
 * Reads a persisted Thymian JSON report file and returns its reports.
 *
 * Accepts both the reporter plugin's JSON formatter's native output (an
 * **array** of reports — a session can emit several) and a bare single
 * `Report` object. Each report is validated structurally against the loose
 * `reportSchema` (`additionalProperties: true` — the persisted-report
 * compatibility contract), never strict-parsed, so reports written by newer
 * or older Thymian versions stay readable as long as the core shape holds.
 * The file boundary itself (path resolution, BOM tolerance, read/parse error
 * wording) is the shared `readTypedInputJson` contract all claimants use.
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
  const parsed = await readTypedInputJson(
    location,
    inputLabel,
    cwd,
    'Thymian report',
  );

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
