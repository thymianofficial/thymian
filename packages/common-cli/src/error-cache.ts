import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { Command } from '@oclif/core';

import type { BaseCliRunCommand } from './base-cli-run-command.js';
import type { ThymianBaseCommand } from './thymian-base-command.js';

/**
 * The format of the error record this CLI writes. Only the error-record
 * writer, which redacts what the user typed, stamps a record with it, so a
 * record carrying it went through redaction. Bump it when the shape changes.
 */
export const ERROR_RECORD_VERSION = 1;

export type CachedError = {
  recordVersion: typeof ERROR_RECORD_VERSION;
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

  /**
   * Returns the record only if it carries exactly the record version this CLI
   * writes. A record from a newer CLI (a higher version) is left in place
   * unread: that CLI redacted it, and it can still report it. Anything else is
   * deleted unread: a record without the version was written before redaction
   * and may hold a typed secret in clear, and one with a lower or malformed
   * version, or that does not parse, cannot be vouched for.
   */
  async read(): Promise<CachedError | undefined> {
    const cacheFile = path.join(this.dir, 'last_error.json');

    let content: string;
    try {
      content = await fs.readFile(cacheFile, 'utf-8');
    } catch {
      return undefined;
    }

    try {
      const record = JSON.parse(content);
      const version = record?.recordVersion;
      if (version === ERROR_RECORD_VERSION) {
        return record;
      }
      if (Number.isInteger(version) && version > ERROR_RECORD_VERSION) {
        return undefined;
      }
    } catch {
      /* fall through to deletion */
    }

    // Between the readFile above and this rm, a failing command may write a
    // fresh, stamped record, and the rm then deletes it. That costs the report
    // of one error, and only in a race between two thymian processes, so it is
    // not worth a lock.
    // Best effort. A file that cannot be deleted is still not returned, and is
    // at least no longer readable by others.
    await fs
      .rm(cacheFile, { force: true })
      .catch(() => fs.chmod(cacheFile, 0o600))
      .catch(() => undefined);
    return undefined;
  }

  async reset(): Promise<void> {
    const cacheFile = path.join(this.dir, 'last_error.json');

    // `force` makes a missing file a no-op; any other error still rejects.
    await fs.rm(cacheFile, { force: true });
  }

  static forCommand(
    command:
      ThymianBaseCommand<typeof Command> | BaseCliRunCommand<typeof Command>,
  ): ErrorCache {
    return new ErrorCache(command.config.cacheDir);
  }
}
