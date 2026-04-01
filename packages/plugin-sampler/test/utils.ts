import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createTempDir(name: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), name));
}
