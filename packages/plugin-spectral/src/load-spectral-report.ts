import { readTypedInputJson, ThymianBaseError } from '@thymian/core';

import type { SpectralResult } from './spectral-types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value['line']) &&
    isNonNegativeInteger(value['character'])
  );
}

function isStringWhenPresent(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

// Validates the full declared SpectralResult contract — the `as
// SpectralResult[]` cast below vouches for exactly what is checked here, so
// every required field the mapping code dereferences must be covered.
function isSpectralResult(value: unknown): value is SpectralResult {
  if (!isRecord(value)) {
    return false;
  }

  const range = value['range'];
  const code = value['code'];

  return (
    (typeof code === 'string' || typeof code === 'number') &&
    typeof value['message'] === 'string' &&
    typeof value['severity'] === 'number' &&
    Array.isArray(value['path']) &&
    isRecord(range) &&
    isPosition(range['start']) &&
    isPosition(range['end']) &&
    isStringWhenPresent(value['source']) &&
    isStringWhenPresent(value['documentationUrl'])
  );
}

/**
 * Reads a single Spectral JSON report (`spectral lint -f json` output),
 * validates its structure, and returns the parsed results.
 *
 * Unknown extra fields on entries are tolerated (forward-compatible). The
 * file boundary itself (path resolution, BOM tolerance, read/parse error
 * wording) is the shared `readTypedInputJson` contract all claimants use.
 *
 * @param inputLabel the offending input's identity (`type:location`), used in
 *   every error message so failures trace back to the CLI input (AC 5).
 * @throws {ThymianBaseError} if the file is unreadable, not valid JSON, not a
 *   result array, or an entry misses the required
 *   `code`/`message`/`severity`/`path`/`range` shape.
 */
export async function loadSpectralReport(
  location: string,
  inputLabel: string,
  cwd: string,
): Promise<SpectralResult[]> {
  const parsed = await readTypedInputJson(
    location,
    inputLabel,
    cwd,
    'Spectral report',
  );

  if (!Array.isArray(parsed)) {
    throw new ThymianBaseError(
      `Unsupported Spectral report "${inputLabel}": expected the JSON array produced by \`spectral lint -f json\`.`,
    );
  }

  for (const [index, entry] of parsed.entries()) {
    if (!isSpectralResult(entry)) {
      throw new ThymianBaseError(
        `Unsupported Spectral report "${inputLabel}": result ${index.toString()} does not match the \`spectral lint -f json\` result shape (code/message/severity/path/range).`,
      );
    }
  }

  return parsed as SpectralResult[];
}
