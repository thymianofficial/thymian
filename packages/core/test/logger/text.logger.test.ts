import chalk from 'chalk';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vitest,
} from 'vitest';

import { TextLogger } from '../../src/logger/text.logger.js';

describe('TextLogger', () => {
  chalk.level = 0;

  let consoleMock: MockInstance<
    (message?: unknown, ...optionalParams: unknown[]) => void
  >;

  beforeEach(() => {
    consoleMock = vitest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleMock.mockReset();
  });

  it('should include name in logs', () => {
    const logger = new TextLogger('My cool logger', 'info');
    logger.info('should be printed');

    expect(consoleMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /INFO \[.*\] \[My cool logger\]: should be printed/,
      ),
    );
  });

  it('should not log debug without verbose mode', () => {
    const logger = new TextLogger('', 'warn');
    logger.debug('should not be printed');

    expect(consoleMock).not.toHaveBeenCalled();
  });

  it('should log debug with verbose mode', () => {
    const logger = new TextLogger('', 'debug');
    logger.debug('should be printed');

    expect(consoleMock).toHaveBeenCalled();
  });

  it('should create child logger with new name and inherited log level', () => {
    const baseLogger = new TextLogger('BaseLogger', 'debug');
    const childLogger = baseLogger.child('ChildLogger');

    expect(childLogger.namespace).toBe('ChildLogger');
    expect(childLogger.level).toBe('debug');
  });

  it('should suppress out() output when log level is silent', () => {
    const logger = new TextLogger('', 'silent');
    logger.out('should not be printed');

    expect(consoleMock).not.toHaveBeenCalled();
  });

  it('should allow out() output when log level is not silent', () => {
    const logger = new TextLogger('', 'warn');
    logger.out('should be printed');

    expect(consoleMock).toHaveBeenCalledWith('should be printed');
  });
});
