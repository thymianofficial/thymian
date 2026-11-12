/** What a redacted value is replaced with in the error record. */
export const REDACTED = '<redacted>';

/**
 * A value shorter than this is not scrubbed out of free text (message, stack,
 * cause): replacing a short value such as `info` or `yaml` everywhere would
 * mangle the stack. It is still redacted in argv itself, whatever its length,
 * so this trades a short secret echoed in an error message for a readable
 * stack.
 */
const MIN_SCRUBBED_LENGTH = 8;

/**
 * The key of the repeated `-o <plugin>.<path>=<value>` form: it always has a
 * `.`. A value of `-o`/`--option` whose part before `=` has this shape keeps
 * that part, as long as something other than `=` follows; anything else is
 * redacted whole. The value of any other flag is never split: a dotted token
 * with base64 padding (`aaa.bbb.ccc=`) has the same shape.
 */
const OPTION_KEY = /^[\w@/[\]-]+\.[\w@./[\]-]+$/;

export type RedactedArgv = {
  /** argv with every value replaced by {@link REDACTED}. */
  argv: string[];
  /** The raw values that were replaced, to scrub them from free text too. */
  redactedValues: string[];
};

/**
 * Redact every value from a raw `process.argv`, keeping its structure: the
 * node and bin entries, the command words as typed, flag names and their
 * order. It works on raw argv, without the command's flag definitions,
 * because the record is also written when parsing itself failed — so it
 * cannot tell a flag's value from a positional argument, and redacts both.
 *
 * The command words are the leading non-flag tokens, up to as many `:`- or
 * space-separated parts as `commandId` has. The first is kept as typed, not
 * as resolved, so a record for a "did you mean …?" suggestion still shows the
 * command the user actually typed; a later one only when it matches the
 * resolved id, since a mismatch may be a positional argument. Without a
 * `commandId` none are kept.
 */
export function redactArgv(
  argv: readonly string[],
  commandId: string | undefined,
): RedactedArgv {
  const redactedValues: string[] = [];
  const redactValue = (value: string, isOptionValue = false): string => {
    const [key, rest] = splitAtEquals(value);
    if (
      isOptionValue &&
      rest &&
      OPTION_KEY.test(key) &&
      !rest.startsWith('=')
    ) {
      redactedValues.push(rest);
      return `${key}=${REDACTED}`;
    }
    redactedValues.push(value);
    return REDACTED;
  };

  const [node, bin, ...rest] = argv;
  const head = [node, bin].filter((entry) => entry !== undefined);

  const idParts = commandId ? commandId.split(/[: ]/) : [];
  let consumed = 0;
  const commandWords: string[] = [];
  for (const token of rest) {
    const parts = token.split(':');
    const end = consumed + parts.length;
    const matchesId = parts.every((part, i) => part === idParts[consumed + i]);
    if (
      token.startsWith('-') ||
      end > idParts.length ||
      (consumed > 0 && !matchesId)
    ) {
      break;
    }
    consumed = end;
    commandWords.push(token);
  }

  const tail: string[] = [];
  let afterDoubleDash = false;
  // `-o`/`--option` takes several values (`-o a.b=1 c.d=2`), so every token
  // up to the next flag counts as one of them.
  let inOption = false;
  for (const token of rest.slice(commandWords.length)) {
    if (afterDoubleDash) {
      tail.push(redactValue(token));
    } else if (token === '--') {
      afterDoubleDash = true;
      tail.push(token);
    } else if (token.startsWith('--')) {
      const [name, value] = splitAtEquals(token);
      inOption = name === '--option';
      tail.push(
        value === undefined ? name : `${name}=${redactValue(value, inOption)}`,
      );
    } else if (token.startsWith('-') && token.length > 2) {
      // `-tVALUE` or `-t=VALUE`; a cluster of booleans (`-dv`) looks the same
      // and is redacted too, which is the safe side to err on.
      const name = token.slice(0, token[2] === '=' ? 3 : 2);
      inOption = name.startsWith('-o');
      tail.push(`${name}${redactValue(token.slice(name.length), inOption)}`);
    } else if (token.startsWith('-')) {
      inOption = token === '-o';
      tail.push(token); // `-t`, or `-` for stdin
    } else {
      tail.push(redactValue(token, inOption));
    }
  }

  return {
    argv: [...head, ...commandWords, ...tail],
    redactedValues: [
      ...redactedValues,
      ...redactedValues.flatMap(urlCredentials),
    ].filter((value) => value.length > 0),
  };
}

/** Split at the first `=`; the second part is undefined without one. */
function splitAtEquals(token: string): [string, string | undefined] {
  const eq = token.indexOf('=');
  return eq === -1
    ? [token, undefined]
    : [token.slice(0, eq), token.slice(eq + 1)];
}

/**
 * The userinfo and query values of every URL inside `value`. Free text tends
 * to echo a URL's parts rather than the raw argv token (`har:https://…`), so
 * they are scrubbed on their own too — percent-encoded as they were typed,
 * and decoded, since the text may echo either.
 */
function urlCredentials(value: string): string[] {
  return [...value.matchAll(/[a-z][\w+.-]*:\/\/\S+/gi)].flatMap(([match]) => {
    try {
      const url = new URL(match);
      const typed = [
        url.username,
        url.password,
        ...url.search
          .slice(1)
          .split('&')
          .map((pair) => splitAtEquals(pair)[1] ?? ''),
      ];
      return [
        ...typed,
        ...typed.map(decodeOrKeep),
        ...url.searchParams.values(),
      ];
    } catch {
      return [];
    }
  });
}

/** Percent-decode `value`, or return it as it is when it is malformed. */
function decodeOrKeep(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Replace every occurrence of `redactedValues` in the strings of `value`,
 * walking arrays and objects the way `JSON.stringify` would (own enumerable
 * properties, or what `toJSON()` returns). Used on the record's free-text
 * fields, which can echo a flag value back (e.g. `Invalid option format:
 * "<input>"`). Like `JSON.stringify`, it throws what a getter or a `toJSON()`
 * of `value` throws.
 */
export function scrubSecrets<T>(
  value: T,
  redactedValues: readonly string[],
): T {
  const scrubbable = redactedValues.filter(
    (redacted) => redacted.length >= MIN_SCRUBBED_LENGTH,
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
    try {
      const json: unknown =
        'toJSON' in current && typeof current.toJSON === 'function'
          ? current.toJSON()
          : current;
      // A `toJSON()` that hands back the object itself is walked as it is.
      if (json !== current) {
        return walk(json);
      }
      return Array.isArray(current)
        ? current.map(walk)
        : Object.fromEntries(
            Object.entries(current).map(([key, entry]) => [key, walk(entry)]),
          );
    } finally {
      ancestors.delete(current);
    }
  };

  return walk(value) as T;
}
