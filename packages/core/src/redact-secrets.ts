/** What a redacted value is replaced with. */
export const REDACTED = '<redacted>';

/**
 * Property names whose values are credentials, in any plugin's options:
 * `token`, `apiKey`, `client_secret`, `privateKey`, `password`, `cookie`, …
 */
const SECRET_KEY =
  /token|secret|passw(or)?d|pwd|passphrase|authorization|bearer|credential|api[-_]?key|private[-_]?key|cookie|jwt/i;

/**
 * Serializes a value for a log line, with the value of every property that
 * looks like a credential replaced by {@link REDACTED}, at any depth.
 *
 * Plugin options are free-form, so this goes by the property name. Numbers and
 * booleans are kept, since a setting such as `maxTokens` or `useCookies` is
 * not a secret. It is a safety net for logging, not a guarantee: a secret
 * under an unrelated name is not recognized.
 */
export function stringifyRedacted(value: unknown): string {
  return JSON.stringify(value, (key, nested: unknown) =>
    nested != null &&
    typeof nested !== 'number' &&
    typeof nested !== 'boolean' &&
    SECRET_KEY.test(key)
      ? REDACTED
      : nested,
  );
}
