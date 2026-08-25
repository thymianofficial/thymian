import { access } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { ThymianBaseError } from '@thymian/core';

export function sanitize(name: string): string {
  return decodeURIComponent(name).replace(/[^a-z0-9.-]/gi, '_');
}

/**
 * The `name` {@link checkForSafePath} raises under.
 *
 * A constant because the guard in `read-samples-from-dir.ts` has to recognise
 * this one error to keep re-raising it while everything else degrades, and it
 * used to do that by comparing the literal string in a second file.
 */
export const PATH_TRAVERSAL_ERROR_NAME = 'PathTraversalError';

export function checkForSafePath(path: string, baseDir: string): void {
  const resolvedBaseDir = resolve(baseDir);
  const resolvedPath = resolve(resolvedBaseDir, path);
  const relativePath = relative(resolvedBaseDir, resolvedPath);

  const isSafe =
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath);

  if (!isSafe) {
    throw new ThymianBaseError(
      `Access denied. Path "${resolvedPath}" is outside of the base directory "${resolvedBaseDir}".`,
      {
        name: PATH_TRAVERSAL_ERROR_NAME,
        ref: 'https://thymian.dev/references/errors/path-traversal-error/',
      },
    );
  }
}

export async function entryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (e) {
    return false;
  }
}
