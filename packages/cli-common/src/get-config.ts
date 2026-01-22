import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { parse } from 'yaml';

import { defaultConfig } from './default-config.js';
import type { ThymianConfig } from './thymian-config.js';
import { validateConfig } from './validate-config.js';

export async function getConfig(
  file: string,
  cwd = process.cwd(),
): Promise<ThymianConfig> {
  const fullPath = path.join(cwd, file);
  try {
    if (!existsSync(fullPath)) {
      return defaultConfig;
    }

    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const { ext } = path.parse(fullPath);

    let config!: unknown;

    if (ext === '.json') {
      try {
        config = JSON.parse(fileContent);
      } catch (e) {
        throw new Error(`Invalid JSON file at path ${fullPath}.`);
      }
    } else if (ext === '.yaml' || ext === '.yml') {
      try {
        config = parse(fileContent);
      } catch (e) {
        throw new Error(`Invalid yaml file at path ${fullPath}.`);
      }
    } else {
      throw new Error(
        `Unsupported file extension "${ext}" for Thymian configuration.`,
      );
    }

    const validationResult = validateConfig(config);

    if (!validationResult.valid) {
      throw new Error(`Invalid Thymian config`, {
        cause: validationResult.message,
      });
    }

    return config as ThymianConfig;
  } catch (e) {
    if (e instanceof Error) {
      console.error(`Cannot run Thymian CLI because of: ${e.message}`);

      if (e.cause) {
        console.error(e.cause);
      }
    }
    process.exit(2);
  }
}
