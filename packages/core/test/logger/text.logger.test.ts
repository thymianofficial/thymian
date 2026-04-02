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

  let consoleErrorMock: MockInstance<
    (message?: unknown, ...optionalParams: unknown[]) => void
  >;
  let consoleLogMock: MockInstance<
    (message?: unknown, ...optionalParams: unknown[]) => void
  >;

  beforeEach(() => {
    consoleErrorMock = vitest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    consoleLogMock = vitest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorMock.mockReset();
    consoleLogMock.mockReset();
  });

  it('should include name in logs', () => {
    const logger = new TextLogger('My cool logger', 'info');
    logger.info('should be printed');

    expect(consoleErrorMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /INFO \[.*\] \[My cool logger\]: should be printed/,
      ),
    );
  });

  it('should not log debug without verbose mode', () => {
    const logger = new TextLogger('', 'warn');
    logger.debug('should not be printed');

    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  it('should log debug with verbose mode', () => {
    const logger = new TextLogger('', 'debug');
    logger.debug('should be printed');

    expect(consoleErrorMock).toHaveBeenCalled();
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

    expect(consoleLogMock).not.toHaveBeenCalled();
  });

  it('should allow out() output when log level is not silent', () => {
    const logger = new TextLogger('', 'warn');
    logger.out('should be printed');

    expect(consoleLogMock).toHaveBeenCalledWith('should be printed');
  });

  it('should route all diagnostic methods to stderr', () => {
    const logger = new TextLogger('test', 'trace');

    logger.trace('trace msg');
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    expect(consoleErrorMock).toHaveBeenCalledTimes(5);
    expect(consoleLogMock).not.toHaveBeenCalled();
  });

  it('should route out() to stdout', () => {
    const logger = new TextLogger('test', 'info');
    logger.out('stdout message');

    expect(consoleLogMock).toHaveBeenCalledWith('stdout message');
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });
});
