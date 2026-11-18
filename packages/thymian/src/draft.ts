import os from 'node:os';
import path from 'node:path';

/**
 * A draft for `thymian feedback`: what the user reviews — its heading (an
 * issue title or an email subject) and body — and the URL that sends exactly
 * that.
 */
export type Draft = {
  heading: string;
  body: string;
  url: string;
};

/** How a draft for `thymian feedback` is built. */
export type DraftOptions = {
  /** Leave the stack out, with a placeholder line where it was. */
  withoutStack?: boolean;
};

/**
 * Replace the home directory in a stack with `~`, so the draft a user reviews
 * does not carry their user name in every frame.
 *
 * `os.homedir()` rather than `HOME`: Windows has no `HOME`, and an empty
 * search string would put `~` between every character. Only the home
 * directory followed by a separator (either kind) is replaced, so `/home/al` leaves
 * `/home/alice` alone. Without a home directory, or with the root as one, the
 * stack is left as it is.
 */
export function shortenHomeDir(stack: string): string {
  const home = os.homedir();

  if (!home || path.parse(home).root === home) {
    return stack;
  }

  const escaped = home.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return stack.replaceAll(new RegExp(`${escaped}(?=[\\\\/])`, 'g'), '~');
}
