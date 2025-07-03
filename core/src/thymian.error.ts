export interface ThymianErrorOptions {
  exitCode: number;
  suggestions: string[];
  ref: string;
  code: string;
  name: string;
}

export class ThymianError extends Error {
  public readonly causingError?: Error;
  public readonly options: Partial<ThymianErrorOptions> & { cause?: Error };

  constructor(
    message: string,
    options: Partial<ThymianErrorOptions> & { cause?: unknown } = {}
  ) {
    super(message);
    if (options.cause) {
      if (!(options.cause instanceof Error)) {
        delete options.cause;
      }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.options = {
      ...options,
    };
    this.name = options.name ?? this.constructor.name;
  }
}
