import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { ThymianBaseError } from '@thymian/core';

import type { SpectralResult } from './spectral-types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['line'] === 'number' &&
    typeof value['character'] === 'number'
  );
}

function isSpectralResult(value: unknown): value is SpectralResult {
  if (!isRecord(value)) {
    return false;
  }

  const range = value['range'];

  return (
    typeof value['message'] === 'string' &&
    typeof value['severity'] === 'number' &&
    isRecord(range) &&
    isPosition(range['start']) &&
    isPosition(range['end'])
  );
}

/**
 * Reads a single Spectral JSON report (`spectral lint -f json` output),
 * validates its structure, and returns the parsed results.
 *
 * Unknown extra fields on entries are tolerated (forward-compatible).
 *
 * @param inputLabel the offending input's identity (`type:location`), used in
 *   every error message so failures trace back to the CLI input (AC 5).
 * @throws {ThymianBaseError} if the file is unreadable, not valid JSON, not a
 *   result array, or an entry misses the required `message`/`severity`/`range`
 *   shape.
 */
export async function loadSpectralReport(
  location: string,
  inputLabel: string,
  cwd: string,
): Promise<SpectralResult[]> {
  const filePath = isAbsolute(location) ? location : join(cwd, location);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ThymianBaseError(
      `Failed to read Spectral report "${inputLabel}" (resolved to ${filePath}).`,
      { cause: err instanceof Error ? err : undefined },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new ThymianBaseError(
      `Failed to parse Spectral report "${inputLabel}" as JSON.`,
      { cause: err instanceof Error ? err : undefined },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new ThymianBaseError(
      `Unsupported Spectral report "${inputLabel}": expected the JSON array produced by \`spectral lint -f json\`.`,
    );
  }

  for (const [index, entry] of parsed.entries()) {
    if (!isSpectralResult(entry)) {
      throw new ThymianBaseError(
        `Unsupported Spectral report "${inputLabel}": result ${index.toString()} is missing the required message/severity/range shape.`,
      );
    }
  }

  return parsed as SpectralResult[];
}
