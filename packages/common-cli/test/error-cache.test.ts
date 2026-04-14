import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type CachedError, ErrorCache } from '../src/error-cache.js';

describe('ErrorCache', () => {
  let tempDir: string;
  let errorCache: ErrorCache;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'error-cache-test-'));
    errorCache = new ErrorCache(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('write', () => {
    it('should write error data to cache file', async () => {
      const error: CachedError = {
        name: 'TestError',
        message: 'Test error message',
        commandName: 'test:command',
        timestamp: Date.now(),
        argv: ['node', 'thymian', 'test'],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
          osVersion: 'Linux',
        },
        pluginVersions: [],
      };

      await errorCache.write(error);

      const cacheFile = join(tempDir, 'last_error.json');
      const content = await readFile(cacheFile, 'utf-8');
      const cached = JSON.parse(content);

      expect(cached).toEqual(error);
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'path');
      const nestedCache = new ErrorCache(nestedDir);

      const error: CachedError = {
        name: 'TestError',
        message: 'Test',
        commandName: 'test',
        timestamp: Date.now(),
        argv: [],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
        },
        pluginVersions: [],
      };

      await nestedCache.write(error);

      const cacheFile = join(nestedDir, 'last_error.json');
      const content = await readFile(cacheFile, 'utf-8');

      expect(content).toBeDefined();
    });

    it('should overwrite existing cache file', async () => {
      const error1: CachedError = {
        name: 'FirstError',
        message: 'First',
        commandName: 'test1',
        timestamp: 1000,
        argv: [],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
        },
        pluginVersions: [],
      };

      const error2: CachedError = {
        name: 'SecondError',
        message: 'Second',
        commandName: 'test2',
        timestamp: 2000,
        argv: [],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
        },
        pluginVersions: [],
      };

      await errorCache.write(error1);
      await errorCache.write(error2);

      const cached = await errorCache.read();
      expect(cached?.name).toBe('SecondError');
      expect(cached?.timestamp).toBe(2000);
    });

    it('should handle write failures gracefully', async () => {
      // Use a null byte in the path to guarantee an invalid path on all OSes.
      // A plain '/invalid/...' path may be writable on Windows because it resolves
      // to the current drive root (for example, C:\invalid\...).
      const invalidCache = new ErrorCache('/invalid/\0/path');
      const error: CachedError = {
        name: 'TestError',
        message: 'Test',
        commandName: 'test',
        timestamp: Date.now(),
        argv: [],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
        },
        pluginVersions: [],
      };

      // Should not throw
      await expect(invalidCache.write(error)).resolves.toBeUndefined();
    });

    it('should include optional fields', async () => {
      const error: CachedError = {
        name: 'TestError',
        message: 'Test error',
        stack: 'Error: Test\n  at test.ts:10',
        cause: { reason: 'underlying cause' },
        commandName: 'test',
        timestamp: Date.now(),
        argv: ['node', 'thymian'],
        version: {
          architecture: 'arm64',
          cliVersion: '2.0.0',
          nodeVersion: 'v20.0.0',
          osVersion: 'Darwin 23.0.0',
        },
        pluginVersions: [
          { name: '@thymian/plugin-openapi', version: '1.0.0' },
          { name: '@thymian/plugin-http-linter', version: '2.0.0' },
        ],
      };

      await errorCache.write(error);
      const cached = await errorCache.read();

      expect(cached?.stack).toBe(error.stack);
      expect(cached?.cause).toEqual(error.cause);
      expect(cached?.version.osVersion).toBe('Darwin 23.0.0');
      expect(cached?.pluginVersions).toHaveLength(2);
    });
  });

  describe('read', () => {
    it('should return undefined when cache file does not exist', async () => {
      const result = await errorCache.read();

      expect(result).toBeUndefined();
    });

    it('should read and parse cached error', async () => {
      const error: CachedError = {
        name: 'ReadTestError',
        message: 'Read test',
        commandName: 'read:test',
        timestamp: 123456,
        argv: ['test'],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
        },
        pluginVersions: [],
      };

      await errorCache.write(error);
      const cached = await errorCache.read();

      expect(cached).toEqual(error);
    });

    it('should return undefined on JSON parse errors', async () => {
      const cacheFile = join(tempDir, 'last_error.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(cacheFile, '{ invalid json }');

      const result = await errorCache.read();

      expect(result).toBeUndefined();
    });

    it('should handle file read failures gracefully', async () => {
      // Use a null byte in the path to guarantee an invalid path on all OSes.
      // A plain '/invalid/...' path may resolve on Windows to the current drive root
      // (for example, C:\invalid\...), so it is not reliably invalid there.
      const invalidCache = new ErrorCache('/invalid/\0/path');

      const result = await invalidCache.read();

      expect(result).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should delete cache file', async () => {
      const error: CachedError = {
        name: 'TestError',
        message: 'Test',
        commandName: 'test',
        timestamp: Date.now(),
        argv: [],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
        },
        pluginVersions: [],
      };

      await errorCache.write(error);
      expect(await errorCache.read()).toBeDefined();

      await errorCache.reset();

      expect(await errorCache.read()).toBeUndefined();
    });

    it('should handle missing file when resetting', async () => {
      // Should not throw when file doesn't exist
      await expect(errorCache.reset()).rejects.toThrow();
    });
  });

  describe('forCommand', () => {
    it('should create ErrorCache with command cache directory', () => {
      const mockCommand = {
        config: {
          cacheDir: '/test/cache/dir',
        },
      } as any;

      const cache = ErrorCache.forCommand(mockCommand);

      expect(cache).toBeInstanceOf(ErrorCache);
    });
  });
});
