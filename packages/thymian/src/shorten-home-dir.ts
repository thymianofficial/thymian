import os from 'node:os';

/**
 * Replace the home directory in a stack with `~`, so the draft a user reviews
 * does not carry their user name in every frame.
 *
 * `os.homedir()` rather than `HOME`: Windows has no `HOME`, and an empty
 * search string would put `~` between every character. Without a home
 * directory the stack is left as it is.
 */
export function shortenHomeDir(stack: string): string {
  const home = os.homedir();

  return home ? stack.replaceAll(home, '~') : stack;
}
