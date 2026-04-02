import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { parse } from 'yaml';

import { defaultConfig } from './default-config.js';
import type { ThymianConfig } from './thymian-config.js';
import { validateConfig } from './validate-config.js';

export interface GetConfigOptions {
  /**
   * Explicit config file path provided via `--config` flag.
   * When set, the file MUST exist — a missing file is a hard error (exit 2).
   */
  configPath?: string;

  /** Working directory for file resolution. Defaults to `process.cwd()`. */
  cwd?: string;
}

/** Well-known config file names checked in order when no explicit `--config` is given. */
const DEFAULT_CONFIG_NAMES = ['thymian.config.yaml'];

/**
 * Resolve and load a Thymian configuration.
 *
 * Resolution chain:
 * 1. If `configPath` is given (explicit `--config`), load that file or error.
 * 2. Otherwise probe cwd for well-known config file names.
 * 3. If no file is found, return `defaultConfig`.
 */
export async function getConfig(
  options: GetConfigOptions = {},
): Promise<ThymianConfig> {
  const cwd = options.cwd ?? process.cwd();

  // Step A: explicit --config path
  if (options.configPath) {
    const fullPath = path.isAbsolute(options.configPath)
      ? options.configPath
      : path.join(cwd, options.configPath);

    if (!existsSync(fullPath)) {
      console.error(`Config not found at ${fullPath}.`);
      process.exit(2);
    }

    return loadAndValidate(fullPath);
  }

  // Step B: probe well-known config file names in cwd
  for (const name of DEFAULT_CONFIG_NAMES) {
    const fullPath = path.join(cwd, name);
    if (existsSync(fullPath)) {
      return loadAndValidate(fullPath);
    }
  }

  // Step B fallback: no config file found — use built-in defaults
  return defaultConfig;
}

async function loadAndValidate(fullPath: string): Promise<ThymianConfig> {
  try {
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const { ext } = path.parse(fullPath);

    let config!: unknown;

    if (ext === '.json') {
      try {
        config = JSON.parse(fileContent);
      } catch {
        throw new Error(`Invalid JSON file at path ${fullPath}.`);
      }
    } else if (ext === '.yaml' || ext === '.yml') {
      try {
        config = parse(fileContent);
      } catch {
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
