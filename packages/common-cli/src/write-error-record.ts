import type { Command } from '@oclif/core';
import type { CommandError } from '@oclif/core/interfaces';

import type { ErrorCache } from './error-cache.js';
import type { Feedback } from './feedback.js';

/**
 * Emit the shared error side effects for a failing command: run the feedback
 * hook and persist a diagnostic record to the error cache.
 *
 * Extracted so `BaseCliRunCommand.catch()` and `ThymianBaseCommand.catch()`
 * don't carry byte-for-byte duplicates of this logic (which is how the two
 * drifted apart). `feedback`/`errorCache` are passed in explicitly because
 * they're `protected` on the command instances — the caller (inside the
 * command class) reads its own fields and hands them over.
 *
 * `process.argv` is recorded verbatim on purpose: it must reflect what the user
 * actually typed. This runs before any argv repointing at the execute/handle
 * boundary, so the record is never contaminated by that fix.
 */
export async function writeErrorRecord(
  command: Command,
  feedback: Feedback | undefined,
  errorCache: ErrorCache | undefined,
  err: CommandError,
): Promise<void> {
  await feedback?.error();

  const versionDetails = command.config.versionDetails;

  const pluginVersions = Object.entries(versionDetails.pluginVersions ?? {})
    .filter(([name]) => !name.startsWith('@oclif'))
    .map(([name, version]) => ({ name, version: version.version }));

  await errorCache?.write({
    name: err.name,
    message: err.message,
    commandName: command.id ?? 'unknown command',
    timestamp: Date.now(),
    cause: err.cause,
    stack: err.stack,
    argv: process.argv,
    version: {
      architecture: versionDetails.architecture,
      cliVersion: versionDetails.cliVersion,
      nodeVersion: versionDetails.nodeVersion,
      osVersion: versionDetails.osVersion,
    },
    pluginVersions,
  });
}
