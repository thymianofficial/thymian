import { readFile } from 'node:fs/promises';

import { JsonLocMapper } from './json-loc-mapper.js';
import { LocMapper } from './loc-mapper.js';
import { YamlLocMapper } from './yaml-loc-mapper.js';

export function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export async function locMapperForFile(path: string): Promise<LocMapper> {
  const text = await readFile(path, 'utf-8');

  return isJson(text)
    ? new JsonLocMapper(text, path)
    : new YamlLocMapper(text, path);
}
