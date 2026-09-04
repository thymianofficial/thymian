export class SkipError extends Error {}

export class FailError extends Error {}

/**
 * A cross-endpoint call was answered with a status the description never
 * declares for that operation.
 *
 * `utils.request` answers a union of every **declared** response, so an
 * undeclared one has no member to be. Throwing is what keeps that union
 * truthful: the alternative is a value whose type is a lie, read by a hook that
 * has no branch for it.
 *
 * A plain `Error` rather than a `ThymianBaseError`, deliberately: this class is
 * re-exported from `@thymian/hooks`, whose runtime import graph must stay free
 * of `@thymian/core` so a hook file resolves with nothing installed beside it.
 * The sentence a user reads is composed at the transaction boundary, which is
 * where the remediation lives.
 */
export class UndeclaredResponseError extends Error {
  /**
   * `instanceof` by **shape**, not by identity.
   *
   * The hooks runtime is loaded through jiti with `moduleCache: false`, so a
   * hook file that imports `@thymian/hooks` gets its own evaluation of this
   * module — and its own class object. Identity comparison would then be false
   * for the very error the runner threw, which makes the one documented way to
   * react to an off-spec response silently never fire. The loader compares
   * registrations by shape for the same reason.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { name?: unknown }).name === 'UndeclaredResponseError' &&
      'selector' in value &&
      'statusCode' in value
    );
  }

  constructor(
    readonly selector: string,
    readonly statusCode: number,
    readonly headers: Record<string, string | string[] | undefined>,
    readonly body: unknown,
  ) {
    super(
      `The transaction "${selector}" was answered with ${statusCode}, which the specification does not declare for that operation.`,
    );

    this.name = 'UndeclaredResponseError';
  }
}
