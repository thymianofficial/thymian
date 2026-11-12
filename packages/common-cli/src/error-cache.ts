import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { Command } from '@oclif/core';

import type { BaseCliRunCommand } from './base-cli-run-command.js';
import type { ThymianBaseCommand } from './thymian-base-command.js';

export type CachedError = {
  name: string;
  message: string;
  stack?: string | undefined;
  cause?: unknown | undefined;
  commandName: string;
  timestamp: number;
  argv: string[];
  version: {
    architecture: string;
    cliVersion: string;
    nodeVersion: string;
    osVersion?: string;
  };
  pluginVersions: {
    name: string;
    version: string;
  }[];
};

export class ErrorCache {
  constructor(private readonly dir: string) {}

  async write(error: CachedError): Promise<void> {
    const cacheFile = path.join(this.dir, 'last_error.json');

    try {
      await fs.mkdir(this.dir, { recursive: true });

      // Owner-only, like any file that may hold what a user typed. `mode` only
      // applies when the file is created, so a file left behind by an older
      // version is tightened before anything is written into it. On Windows
      // both only toggle the read-only bit, and 0o600 leaves it writable.
      await fs.chmod(cacheFile, 0o600).catch(() => undefined);
      await fs.writeFile(cacheFile, JSON.stringify(error), { mode: 0o600 });
    } catch (err) {
      /* empty */
    }
  }

  async read(): Promise<CachedError | undefined> {
    const cacheFile = path.join(this.dir, 'last_error.json');

    try {
      const error = await fs.readFile(cacheFile, 'utf-8');

      return JSON.parse(error);
    } catch (e) {
      return undefined;
    }
  }

  async reset(): Promise<void> {
    const cacheFile = path.join(this.dir, 'last_error.json');

    await fs.unlink(cacheFile);
  }

  static forCommand(
    command:
      ThymianBaseCommand<typeof Command> | BaseCliRunCommand<typeof Command>,
  ): ErrorCache {
    return new ErrorCache(command.config.cacheDir);
  }
}
