import { isRecord, type PartialExceptFor } from './utils.js';

export type ThymianErrorSeverity = 'info' | 'warn' | 'error';

export type ThymianErrorOptions = {
  exitCode: number;
  suggestions: string[];
  ref: string;
  code: string;
  name: string;
  severity: ThymianErrorSeverity;
};

export interface ThymianError {
  name: string;
  message: string;
  options: PartialExceptFor<ThymianErrorOptions, 'severity'>;
}

export function isThymianError(value: unknown): value is ThymianError {
  // Check if all the required properties exist and are of proper type
  return (
    isRecord(value) &&
    typeof value?.name === 'string' &&
    typeof value?.message === 'string' &&
    ((Object.hasOwn(value, 'options') &&
      isRecord(value.options) &&
      (value.options.cause === undefined ||
        value.options.cause instanceof Error)) ||
      !Object.hasOwn(value, 'options'))
  );
}

export class ThymianBaseError extends Error implements ThymianError {
  public readonly options: PartialExceptFor<ThymianErrorOptions, 'severity'>;
  constructor(
    message: string,
    options: Partial<ThymianErrorOptions> & { cause?: unknown } & {
      severity?: ThymianErrorSeverity;
    } = {}
  ) {
    super(message);
    if (options.cause) {
      if (options.cause instanceof Error) {
        this.cause = options.cause;
      }
    }

    this.options = {
      severity: 'error',
      ...options,
    };

    this.name =
      options.name ??
      (this.constructor.name === 'ThymianBaseError'
        ? 'ThymianError'
        : this.constructor.name);
  }
}
