import { describe, it, expect } from 'vitest';
import { ThymianBaseError } from '../src/thymian.error.js';

describe('ThymianError', () => {
  it('should set exit code correctly', () => {
    const error = new ThymianBaseError('An error', {
      exitCode: 42,
    });

    expect(error.options.exitCode).toBe(42);
  });

  it('should set error name for sub classes', () => {
    class Subclass extends ThymianBaseError {}

    const error = new Subclass('Subclass error');

    expect(error.name).toBe('Subclass');
  });

  it('should set causing error for error instance', () => {
    const error = new ThymianBaseError('An error', {
      cause: new Error('Causing error'),
    });

    expect(error.cause).toBeDefined();
    expect(error.cause).toBeInstanceOf(Error);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(error.cause?.message).toBe('Causing error');
  });

  it('should not set causing error for non-error instance', () => {
    const error = new ThymianBaseError('An error', {
      cause: 42,
    });

    expect(error.cause).toBeUndefined();
  });
});
