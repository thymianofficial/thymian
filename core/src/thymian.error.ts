export class ThymianError extends Error {
  public readonly causingError?: Error;

  public exitCode = 1;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.causingError = cause instanceof Error ? cause : undefined;
  }

  withExitCode(exitCode: number): this {
    this.exitCode = exitCode;
    return this;
  }
}
