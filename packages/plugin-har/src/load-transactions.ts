import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import type {
  CapturedTransaction,
  HttpParticipantRole,
  Logger,
} from '@thymian/core';
import { ThymianBaseError } from '@thymian/core';

import { getValidationErrors, validateHar } from './har-schema.js';
import { transformHar } from './har-transformer.js';

/**
 * Reads a single HAR file, validates its structure, and returns
 * the transformed transactions.
 *
 * @throws {ThymianBaseError} if the file is too large, unreadable,
 *   not valid JSON, or not a valid HAR structure.
 */
export async function loadTransactionsFromHar(
  location: string,
  logger: Logger,
  cwd: string,
  maxFileSize: number,
  clientRole: HttpParticipantRole,
  serverRole: HttpParticipantRole,
): Promise<CapturedTransaction[]> {
  const filePath = isAbsolute(location) ? location : join(cwd, location);

  // Guard against oversized files to prevent out-of-memory crashes.
  // JSON.parse roughly doubles memory usage, so capping the file size
  // keeps total heap impact predictable.
  const fileStats = await stat(filePath).catch((err: unknown) => {
    throw new ThymianBaseError(`Failed to read HAR file: ${filePath}`, {
      cause: err instanceof Error ? err : undefined,
    });
  });

  if (fileStats.size > maxFileSize) {
    throw new ThymianBaseError(
      `HAR file exceeds maximum size (${fileStats.size.toString()} bytes > ${maxFileSize.toString()} bytes): ${filePath}`,
    );
  }

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ThymianBaseError(`Failed to read HAR file: ${filePath}`, {
      cause: err instanceof Error ? err : undefined,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ThymianBaseError(`Failed to parse HAR file as JSON: ${filePath}`);
  }

  if (!validateHar(parsed)) {
    throw new ThymianBaseError(
      `Invalid HAR structure in ${filePath}: ${getValidationErrors()}`,
    );
  }

  const { transactions, skippedCount } = transformHar(
    parsed,
    clientRole,
    serverRole,
  );

  if (skippedCount > 0) {
    logger.warn(
      `Skipped ${skippedCount.toString()} HAR ${skippedCount === 1 ? 'entry' : 'entries'} without response in ${filePath}`,
    );
  }

  return transactions;
}
