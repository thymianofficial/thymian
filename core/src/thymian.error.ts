export class ThymianError extends Error {
  public readonly causingError?: Error;

  public readonly exitCode;

  constructor(message: string, cause?: unknown, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
    this.name = this.constructor.name;
    this.causingError = cause instanceof Error ? cause : undefined;
  }
}
