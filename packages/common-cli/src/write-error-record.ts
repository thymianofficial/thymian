import type { Command } from '@oclif/core';
import type { CommandError } from '@oclif/core/interfaces';

import type { ErrorCache } from './error-cache.js';
import type { Feedback } from './feedback.js';
import { redactArgv, scrubSecrets } from './redact-argv.js';

/**
 * Emit the shared error side effects for a failing command: run the feedback
 * hook and persist a diagnostic record to the error cache.
 *
 * Extracted so `BaseCliRunCommand.catch()` and `ThymianBaseCommand.catch()`
 * don't carry byte-for-byte duplicates of this logic (which is how the two
 * drifted apart). `feedback`/`errorCache` are passed in explicitly because
 * they're `protected` on the command instances — the caller (inside the
 * command class) reads its own fields and hands them over. Both are optional
 * and so trail the required parameters — a command that fails during `init()`
 * has neither wired up yet.
 *
 * `process.argv` is recorded as the user typed it, not as it was resolved: its
 * command words stay as typed, and this runs before any argv repointing at the
 * execute/handle boundary, so the record is never contaminated by that fix.
 * Its values are redacted, though, and scrubbed from the message, stack and
 * cause too: a flag can carry a credential (`-o some-plugin.auth.token=…`),
 * and `thymian feedback` puts the stack into a public GitHub issue.
 */
export async function writeErrorRecord(
  command: Command,
  err: CommandError,
  feedback?: Feedback,
  errorCache?: ErrorCache,
): Promise<void> {
  await feedback?.error();

  const versionDetails = command.config.versionDetails;

  const pluginVersions = Object.entries(versionDetails.pluginVersions ?? {})
    .filter(([name]) => !name.startsWith('@oclif'))
    .map(([name, version]) => ({ name, version: version.version }));

  const { argv, redactedValues } = redactArgv(process.argv, command.id);

  await errorCache?.write({
    name: err.name,
    message: scrubSecrets(err.message, redactedValues),
    commandName: command.id ?? 'unknown command',
    timestamp: Date.now(),
    cause: scrubSecrets(err.cause, redactedValues),
    stack: scrubSecrets(err.stack, redactedValues),
    argv,
    version: {
      architecture: versionDetails.architecture,
      cliVersion: versionDetails.cliVersion,
      nodeVersion: versionDetails.nodeVersion,
      osVersion: versionDetails.osVersion,
    },
    pluginVersions,
  });
}
