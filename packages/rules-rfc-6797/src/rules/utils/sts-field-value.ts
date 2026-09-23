// The Strict-Transport-Security field value, parsed against RFC 6797 §6.1:
//
//   Strict-Transport-Security = "Strict-Transport-Security" ":"
//                               [ directive ]  *( ";" [ directive ] )
//   directive                 = directive-name [ "=" directive-value ]
//   directive-name            = token
//   directive-value           = token | quoted-string
//
// with RFC 2616's token and quoted-string, and its implied linear whitespace
// between them. This is the generic grammar only: what each directive must
// look like (max-age's delta-seconds, includeSubDomains being valueless, no
// directive twice) is left to the rule that owns that requirement, so one
// defect in a header yields one violation from one rule.

export const STS_HEADER = 'strict-transport-security';

// One directive as the UA sees it: the name lowercased, because §6.1 item 3
// makes directive names case-insensitive, and the value after quoted-string
// unescaping (§6.1.1 applies max-age's syntax "after quoted-string
// unescaping"). `value` is absent for a valueless directive.
export type StsDirective = { name: string; value?: string };

export type StsFieldValue =
  | { conforms: true; directives: StsDirective[] }
  | { conforms: false; problem: string };

// RFC 2616 §2.2: token = 1*<any CHAR except CTLs or separators>.
const SEPARATORS = new Set('()<>@,;:\\"/[]?={} \t');

function isTokenChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code > 31 && code < 127 && !SEPARATORS.has(char);
}

function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code < 32 && char !== '\t') || code === 127;
}

function describe(char: string | undefined): string {
  return char === undefined ? 'the end of the value' : JSON.stringify(char);
}

export function parseStsFieldValue(fieldValue: string): StsFieldValue {
  const directives: StsDirective[] = [];
  let i = 0;

  const skipWhitespace = () => {
    while (fieldValue[i] === ' ' || fieldValue[i] === '\t') {
      i++;
    }
  };
  const readToken = () => {
    const start = i;
    while (i < fieldValue.length && isTokenChar(fieldValue[i] as string)) {
      i++;
    }
    return fieldValue.slice(start, i);
  };
  // Positioned on the opening quote; returns the unescaped content, or
  // undefined when the string never closes or carries a control character.
  const readQuotedString = (): string | undefined => {
    let content = '';
    i++;
    while (i < fieldValue.length) {
      const char = fieldValue[i] as string;
      if (char === '"') {
        i++;
        return content;
      }
      if (char === '\\') {
        const escaped = fieldValue[i + 1];
        if (escaped === undefined || escaped.charCodeAt(0) > 127) {
          return undefined;
        }
        content += escaped;
        i += 2;
        continue;
      }
      if (isControl(char)) {
        return undefined;
      }
      content += char;
      i++;
    }
    return undefined;
  };
  const fail = (problem: string): StsFieldValue => ({
    conforms: false,
    problem,
  });

  for (;;) {
    skipWhitespace();

    if (i < fieldValue.length && fieldValue[i] !== ';') {
      const name = readToken();
      if (name === '') {
        return fail(
          `expected a directive name but found ${describe(fieldValue[i])}`,
        );
      }
      skipWhitespace();

      let value: string | undefined;
      if (fieldValue[i] === '=') {
        i++;
        skipWhitespace();
        if (fieldValue[i] === '"') {
          value = readQuotedString();
          if (value === undefined) {
            return fail(`the quoted value of "${name}" is malformed`);
          }
        } else {
          value = readToken();
          if (value === '') {
            return fail(
              `"${name}=" is followed by ${describe(fieldValue[i])} instead of a token or a quoted-string`,
            );
          }
        }
        skipWhitespace();
      }

      directives.push(
        value === undefined
          ? { name: name.toLowerCase() }
          : { name: name.toLowerCase(), value },
      );
    }

    if (i >= fieldValue.length) {
      return { conforms: true, directives };
    }
    if (fieldValue[i] !== ';') {
      return fail(
        `directives must be separated by ";", but ${describe(fieldValue[i])} follows "${fieldValue.slice(0, i).trim()}"`,
      );
    }
    i++;
  }
}

export function findDirectives(
  directives: readonly StsDirective[],
  name: string,
): StsDirective[] {
  return directives.filter((directive) => directive.name === name);
}

// RFC 2616 §3.3.2: delta-seconds = 1*DIGIT.
export function isDeltaSeconds(value: string | undefined): value is string {
  return value !== undefined && /^[0-9]+$/.test(value);
}
