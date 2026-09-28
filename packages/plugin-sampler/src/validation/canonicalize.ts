import ts from 'typescript';

/**
 * A comparison form of a declaration file: every token, one space apart, with
 * comments and JSDoc gone.
 *
 * The drift signal is about the *type surface*, not about its prose. A
 * description-only edit in the API description changes the JSDoc the emitter
 * writes and nothing else, and reporting that as drift would make the gate red
 * for a diff that cannot break a hook. Reformatting is the same class of
 * non-event.
 *
 * Tokenized rather than regex-stripped: `//` inside a string literal is not a
 * comment, and a scanner is the only thing that knows the difference.
 */
export function canonicalize(source: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    // Skip trivia: whitespace and comments never reach us.
    true,
    ts.LanguageVariant.Standard,
    source,
  );
  const tokens: string[] = [];

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    tokens.push(scanner.getTokenText());
  }

  return tokens.join(' ');
}

/** Whether two declaration files say the same thing about types. */
export function sameSurface(a: string, b: string): boolean {
  return canonicalize(a) === canonicalize(b);
}
