import { access } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { ThymianBaseError } from '@thymian/core';

export function sanitize(name: string): string {
  return decodeURIComponent(name).replace(/[^a-z0-9.-]/gi, '_');
}

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
        name: 'PathTraversalError',
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
