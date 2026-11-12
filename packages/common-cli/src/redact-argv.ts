/** What a redacted value is replaced with in the error record. */
export const REDACTED = '<redacted>';

/**
 * A value shorter than this is not scrubbed out of free text (message, stack,
 * cause): replacing a short value such as `info` or `yaml` everywhere would
 * mangle the stack, and a value that short is not a credential worth hiding.
 * It is still redacted in argv itself, whatever its length.
 */
const MIN_SCRUBBED_LENGTH = 8;

/**
 * The key of the repeated `-o <plugin>.<path>=<value>` form. A value whose
 * part before `=` has this shape keeps that part; anything else, notably a
 * URL (which has a `:`), is redacted whole.
 */
const OPTION_KEY = /^[\w@./[\]-]+$/;

export type RedactedArgv = {
  /** argv with every value replaced by {@link REDACTED}. */
  argv: string[];
  /** The raw values that were replaced, to scrub them from free text too. */
  secrets: string[];
};

/**
 * Redact every value from a raw `process.argv`, keeping its structure: the
 * node and bin entries, the command words as typed, flag names and their
 * order. It works on raw argv, without the command's flag definitions,
 * because the record is also written when parsing itself failed — so it
 * cannot tell a flag's value from a positional argument, and redacts both.
 *
 * The command words are the leading non-flag tokens, up to as many `:`- or
 * space-separated parts as `commandId` has. They are kept as typed, not as
 * resolved, so a record for a "did you mean …?" suggestion still shows the
 * command the user actually typed. Without a `commandId` none are kept.
 */
export function redactArgv(
  argv: readonly string[],
  commandId: string | undefined,
): RedactedArgv {
  const secrets: string[] = [];
  const redactValue = (value: string): string => {
    const eq = value.indexOf('=');
    const key = value.slice(0, eq);
    if (eq > 0 && OPTION_KEY.test(key)) {
      secrets.push(value.slice(eq + 1));
      return `${key}=${REDACTED}`;
    }
    secrets.push(value);
    return REDACTED;
  };

  const [node, bin, ...rest] = argv;
  const head = [node, bin].filter((entry) => entry !== undefined);

  let commandParts = commandId ? commandId.split(/[: ]/).length : 0;
  const commandWords: string[] = [];
  for (const token of rest) {
    const parts = token.split(':').length;
    if (token.startsWith('-') || parts > commandParts) {
      break;
    }
    commandParts -= parts;
    commandWords.push(token);
  }

  const tail: string[] = [];
  let afterDoubleDash = false;
  for (const token of rest.slice(commandWords.length)) {
    if (afterDoubleDash) {
      tail.push(redactValue(token));
    } else if (token === '--') {
      afterDoubleDash = true;
      tail.push(token);
    } else if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      tail.push(
        eq === -1
          ? token
          : `${token.slice(0, eq + 1)}${redactValue(token.slice(eq + 1))}`,
      );
    } else if (token.startsWith('-') && token.length > 2) {
      // `-tVALUE` or `-t=VALUE`; a cluster of booleans (`-dv`) looks the same
      // and is redacted too, which is the safe side to err on.
      const name = token.slice(0, token[2] === '=' ? 3 : 2);
      tail.push(`${name}${redactValue(token.slice(name.length))}`);
    } else if (token.startsWith('-')) {
      tail.push(token); // `-t`, or `-` for stdin
    } else {
      tail.push(redactValue(token));
    }
  }

  return {
    argv: [...head, ...commandWords, ...tail],
    secrets: [...secrets, ...secrets.flatMap(urlCredentials)].filter(
      (secret) => secret.length > 0,
    ),
  };
}

/**
 * The userinfo and query values of every URL inside `value`. Free text tends
 * to echo a URL's parts rather than the raw argv token (`har:https://…`), so
 * they are scrubbed on their own too.
 */
function urlCredentials(value: string): string[] {
  return [...value.matchAll(/[a-z][\w+.-]*:\/\/\S+/gi)].flatMap(([match]) => {
    try {
      const url = new URL(match);
      return [
        decodeURIComponent(url.username),
        decodeURIComponent(url.password),
        ...url.searchParams.values(),
      ];
    } catch {
      return [];
    }
  });
}

/**
 * Replace every occurrence of `secrets` in the strings of `value`, walking
 * arrays and plain objects. Used on the record's free-text fields, which can
 * echo a flag value back (e.g. `Invalid option format: "<input>"`).
 */
export function scrubSecrets<T>(value: T, secrets: readonly string[]): T {
  const scrubbable = secrets.filter(
    (secret) => secret.length >= MIN_SCRUBBED_LENGTH,
  );
  if (scrubbable.length === 0) {
    return value;
  }

  const ancestors = new WeakSet<object>();
  const walk = (current: unknown): unknown => {
    if (typeof current === 'string') {
      return scrubbable.reduce(
        (text, secret) => text.replaceAll(secret, REDACTED),
        current,
      );
    }
    if (typeof current !== 'object' || current === null) {
      return current;
    }
    if (ancestors.has(current)) {
      return '[Circular]';
    }
    ancestors.add(current);
    const walked = Array.isArray(current)
      ? current.map(walk)
      : Object.fromEntries(
          Object.entries(current).map(([key, entry]) => [key, walk(entry)]),
        );
    ancestors.delete(current);
    return walked;
  };

  return walk(value) as T;
}
