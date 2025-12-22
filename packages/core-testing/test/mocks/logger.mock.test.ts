import { describe, expect, it, vi } from 'vitest';

import {
  createMockLogger,
  createSilentMockLogger,
  createVerboseMockLogger,
} from '../../src/mocks/logger.mock.js';

describe('Logger Mock', () => {
  describe('createMockLogger', () => {
    it('should create a logger with default namespace', () => {
      const logger = createMockLogger();
      expect(logger.namespace).toBe('mock-logger');
      expect(logger.verbose).toBe(false);
    });

    it('should allow overriding properties', () => {
      const logger = createMockLogger({
        namespace: 'custom-logger',
        verbose: true,
      });
      expect(logger.namespace).toBe('custom-logger');
      expect(logger.verbose).toBe(true);
    });

    it('should stub all logging methods with vi.fn()', () => {
      const logger = createMockLogger();
      expect(vi.isMockFunction(logger.debug)).toBe(true);
      expect(vi.isMockFunction(logger.info)).toBe(true);
      expect(vi.isMockFunction(logger.error)).toBe(true);
      expect(vi.isMockFunction(logger.trace)).toBe(true);
      expect(vi.isMockFunction(logger.warn)).toBe(true);
      expect(vi.isMockFunction(logger.out)).toBe(true);
    });

    it('should allow spying on logging calls', () => {
      const logger = createMockLogger();
      logger.info('test message', 'arg1', 'arg2');

      expect(logger.info).toHaveBeenCalledWith('test message', 'arg1', 'arg2');
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('should create child loggers with proper namespace', () => {
      const logger = createMockLogger({ namespace: 'parent' });
      const child = logger.child('child');

      expect(child.namespace).toBe('parent:child');
    });

    it('should pass verbose flag to child loggers', () => {
      const logger = createMockLogger({ verbose: true });
      const child = logger.child('child');

      expect(child.verbose).toBe(true);
    });

    it('should allow overriding verbose in child', () => {
      const logger = createMockLogger({ verbose: false });
      const child = logger.child('child', true);

      expect(child.verbose).toBe(true);
    });
  });

  describe('createVerboseMockLogger', () => {
    it('should create a logger with verbose enabled', () => {
      const logger = createVerboseMockLogger();
      expect(logger.verbose).toBe(true);
    });

    it('should allow overriding other properties', () => {
      const logger = createVerboseMockLogger({
        namespace: 'verbose-logger',
      });
      expect(logger.namespace).toBe('verbose-logger');
      expect(logger.verbose).toBe(true);
    });
  });

  describe('createSilentMockLogger', () => {
    it('should create a logger with default namespace', () => {
      const logger = createSilentMockLogger();
      expect(logger.namespace).toBe('silent-logger');
      expect(logger.verbose).toBe(false);
    });

    it('should have no-op functions that do not throw', () => {
      const logger = createSilentMockLogger();

      expect(() => logger.debug('test')).not.toThrow();
      expect(() => logger.info('test')).not.toThrow();
      expect(() => logger.error('test')).not.toThrow();
      expect(() => logger.trace('test')).not.toThrow();
      expect(() => logger.warn('test')).not.toThrow();
      expect(() => logger.out('test')).not.toThrow();
    });

    it('should create silent child loggers', () => {
      const logger = createSilentMockLogger();
      const child = logger.child('child');

      expect(child.namespace).toBe('silent-logger:child');
      expect(() => child.info('test')).not.toThrow();
    });
  });
});
