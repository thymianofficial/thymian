import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
 * search string would put `~` between every character. Three spellings of the
 * home directory are replaced, each only when a separator follows, so
 * `/home/al` leaves `/home/alice` alone:
 *
 * - the file URL ESM frames carry (`file:///C:/Users/alice%20smith/`), prefix
 *   included;
 * - the native path, followed by either separator;
 * - on Windows, the native path with forward slashes (`C:/Users/alice/`).
 *
 * Without a home directory, or with the root as one, the stack is left as it
 * is. `home` and `platform` are there for tests.
 */
export function shortenHomeDir(
  stack: string,
  {
    home = os.homedir(),
    platform = process.platform,
  }: { home?: string; platform?: NodeJS.Platform } = {},
): string {
  const windows = platform === 'win32';
  const paths = windows ? path.win32 : path.posix;

  if (!home || paths.parse(home).root === home) {
    return stack;
  }

  const fileUrl = `file://${pathToFileURL(home, { windows }).pathname}`;
  const alternatives = [
    `${escape(fileUrl)}(?=/)`,
    `${escape(home)}(?=[\\\\/])`,
    ...(windows ? [`${escape(home.replaceAll('\\', '/'))}(?=/)`] : []),
  ];

  return stack.replaceAll(new RegExp(alternatives.join('|'), 'g'), '~');
}

function escape(literal: string): string {
  return literal.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
