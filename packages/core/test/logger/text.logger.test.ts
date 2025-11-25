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
    const logger = new TextLogger('My cool logger', false);
    logger.info('should be printed');

    expect(consoleMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /INFO \[.*\] \[My cool logger\]: should be printed/,
      ),
    );
  });

  it('should not log debug without verbose mode', () => {
    const logger = new TextLogger('', false);
    logger.debug('should not be printed');

    expect(consoleMock).not.toHaveBeenCalled();
  });

  it('should log debug with verbose mode', () => {
    const logger = new TextLogger('', true);
    logger.debug('should not be printed');

    expect(consoleMock).toHaveBeenCalled();
  });

  it('should create child logger with new name and same verbose level', () => {
    const baseLogger = new TextLogger('BaseLogger', true);
    const childLogger = baseLogger.child('ChildLogger');

    expect(childLogger.namespace).toBe('ChildLogger');
  });
});
