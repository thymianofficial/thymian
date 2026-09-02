import { access } from 'node:fs/promises';

/** Whether a filesystem entry exists at `path`. */
export async function entryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
