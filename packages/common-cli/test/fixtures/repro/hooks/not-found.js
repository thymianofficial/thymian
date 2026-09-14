// Stand-in for @oclif/plugin-not-found with the "did you mean …?" prompt
// already accepted: re-run the suggested command from inside the hook. This
// reproduces the propagation path (a showHelp parse error thrown while
// process.argv still holds the original, unknown command) without needing a
// TTY or the real inquirer prompt.
export default async function commandNotFound() {
  return this.config.runCommand('greet', []);
}
