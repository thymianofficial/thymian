import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { type JSONSchemaType, validate } from '@thymian/core';
import { parse } from 'yaml';

import { defaultConfig } from './default-config.js';
import type { ThymianConfig } from './thymian-config.js';
import thymianSchema from './thymian-config-schema.json' with { type: 'json' };

export async function getConfig(
  file: string,
  cwd = process.cwd()
): Promise<ThymianConfig> {
  const fullPath = path.join(cwd, file);

  if (!existsSync(fullPath)) {
    return defaultConfig;
  }

  const fileContent = await fs.readFile(fullPath, 'utf-8');
  const { ext } = path.parse(fullPath);

  const config =  ext === 'json' ? JSON.parse(fileContent) : parse(fileContent);

  if (!validate(thymianSchema as unknown as JSONSchemaType<ThymianConfig>, config)) {
    throw new Error('Invalid Thymian config.');
  }

  return config;
}
