/**
 * Recover the argv that oclif core's `handle()` should render help against.
 *
 * When a parse error requests help (`showHelp`), core's `handle()` renders it
 * with `showHelp(process.argv.slice(2))`. That is wrong whenever the command
 * that actually ran differs from what `process.argv` records — most notably
 * when a command is reached via `@oclif/plugin-not-found`'s "did you mean …?"
 * suggestion: `process.argv` still holds the original, unknown command, so
 * `showHelp()` throws "command not found" and dumps raw stack traces.
 *
 * This returns an argv pointed at the command that *actually* ran, recovered
 * from the parse error itself (`err.parse.input.context.id`, the resolved
 * command id, e.g. `explain:rule`). It returns `undefined` when no repoint
 * applies (not a `showHelp` error, or no resolved id available), in which case
 * callers should leave `process.argv` untouched.
 *
 * Pure and side-effect-free so it can be unit-tested without a TTY.
 */
export function argvForHelpError(
  err: unknown,
  argv: string[],
): string[] | undefined {
  const e = err as {
    showHelp?: boolean;
    parse?: { input?: { context?: { id?: string } } };
  };

  if (!e?.showHelp) {
    return undefined;
  }

  const id = e.parse?.input?.context?.id;
  if (!id) {
    return undefined;
  }

  // Keep the leading [node, bin] entries (guarding a short argv) and replace
  // everything after with the resolved command path. handle() only uses argv
  // to resolve *which* command's help to show, so dropping the original
  // flags/args tail is harmless.
  return [...argv.slice(0, 2), ...id.split(':')];
}
