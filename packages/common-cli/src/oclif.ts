export * from '@oclif/core';

import { Errors, flush, run, settings } from '@oclif/core';

import { argvForHelpError } from './repoint-help-argv.js';

type ExecuteOptions = {
  args?: string[];
  development?: boolean;
  dir?: string;
  loadOptions?: Parameters<typeof run>[1];
};

/**
 * Drop-in replacement for `@oclif/core`'s `execute()` (mirrors the v4.13.x
 * body) with a single addition: for parse errors that request help
 * (`showHelp`), repoint `process.argv` at the command that actually ran before
 * delegating to core's `handle()`, then restore it.
 *
 * Why here, and not per-command: core's `handle()` renders such errors with
 * `showHelp(process.argv.slice(2))`. When a command is reached via
 * `@oclif/plugin-not-found`'s "did you mean …?" suggestion, `process.argv`
 * still holds the original *unknown* command, so `showHelp()` throws
 * "command not found" and the emergency catch dumps raw stack traces. This
 * `execute` → `handle` boundary is the single choke point every command shares
 * (both Thymian base classes, `plugin-help`/`-version`, and third-party plugin
 * commands), so one fix covers them all. It runs *after* each command's
 * `catch()` — which records the error with the original argv — so the
 * diagnostic record in `last_error.json` is unaffected.
 *
 * NOTE: this reimplements core's tiny `execute()` orchestration; re-check it on
 * `@oclif/core` major bumps.
 * Upstream bug: https://github.com/oclif/plugin-not-found/issues/1132
 */
export async function execute(options: ExecuteOptions): Promise<unknown> {
  if (!options.dir && !options.loadOptions) {
    throw new Errors.CLIError('dir or loadOptions is required.');
  }

  if (options.development) {
    // In dev mode -> use ts-node and dev plugins
    process.env.NODE_ENV = 'development';
    settings.debug = true;
  }

  return run(
    options.args ?? process.argv.slice(2),
    options.loadOptions ?? options.dir,
  )
    .then((result) => {
      flush();
      return result;
    })
    .catch(async (error) => {
      const repointed = argvForHelpError(error, process.argv);
      if (!repointed) {
        return Errors.handle(error);
      }

      const original = process.argv;
      process.argv = repointed;
      try {
        return await Errors.handle(error);
      } finally {
        process.argv = original;
      }
    });
}
