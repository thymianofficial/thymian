import { describe, it, expect } from 'vitest';
import { ThymianBaseError } from '../src/thymian.error.js';

describe('ThymianError', () => {
  it('should set exit code correctly', () => {
    const error = new ThymianBaseError('An error').withExitCode(127);

    expect(error.exitCode).toBe(127);
  });

  it('should set error name for sub classes', () => {
    class Subclass extends ThymianBaseError {}

    const error = new Subclass('Subclass error');

    expect(error.name).toBe('Subclass');
  });

  it('should set causing error for error instance', () => {
    const error = new ThymianBaseError('An error', new Error('Causing error'));

    expect(error.causingError).toBeDefined();
    expect(error.causingError).toBeInstanceOf(Error);
    expect(error.causingError?.message).toBe('Causing error');
  });

  it('should not set causing error for non-error instance', () => {
    const error = new ThymianBaseError('An error', {});

    expect(error.causingError).toBeUndefined();
  });
});
