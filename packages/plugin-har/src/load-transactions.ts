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
  validateTrafficSource: boolean,
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
    const validationErrors = getValidationErrors();

    if (validateTrafficSource) {
      throw new ThymianBaseError(
        `Invalid HAR structure in ${filePath}: ${validationErrors}`,
      );
    }

    logger.warn(
      `HAR schema validation failed for ${filePath}: ${validationErrors}.`,
    );
  }

  let transformed;

  try {
    transformed = transformHar(parsed as never, clientRole, serverRole);
  } catch (err) {
    throw new ThymianBaseError(`Failed to transform HAR file: ${filePath}`, {
      cause: err instanceof Error ? err : undefined,
    });
  }

  const { transactions, skippedCount, skippedReasons } = transformed;

  if (skippedCount > 0) {
    const uniqueReasons = [...new Set(skippedReasons)].join(', ');
    logger.warn(
      `Skipped ${skippedCount.toString()} HAR ${skippedCount === 1 ? 'entry' : 'entries'} in ${filePath} due to: ${uniqueReasons}`,
    );
  }

  return transactions;
}
