import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ThymianBaseError } from '@thymian/core';

export function sanitize(name: string): string {
  return decodeURIComponent(name).replace(/[^a-z0-9.-]/gi, '_');
}

export function checkForSafePath(path: string, baseDir: string): void {
  const resolvedPath = resolve(baseDir, path);

  const isSafe = resolvedPath.startsWith(baseDir);

  if (!isSafe) {
    throw new ThymianBaseError(
      'Access denied. The generated path is outside of the base directory.',
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
