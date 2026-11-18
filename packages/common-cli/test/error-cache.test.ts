import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ERROR_RECORD_VERSION, ErrorCache } from '../src/error-cache.js';
import { aCachedError } from './support/cached-error.js';

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
      const error = aCachedError({
        message: 'Test error message',
        commandName: 'test:command',
        argv: ['node', 'thymian', 'test'],
        version: {
          architecture: 'x64',
          cliVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
          osVersion: 'Linux',
        },
      });

      await errorCache.write(error);

      const cacheFile = join(tempDir, 'last_error.json');
      const content = await readFile(cacheFile, 'utf-8');
      const cached = JSON.parse(content);

      expect(cached).toEqual(error);
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'path');
      const nestedCache = new ErrorCache(nestedDir);

      const error = aCachedError();

      await nestedCache.write(error);

      const cacheFile = join(nestedDir, 'last_error.json');
      const content = await readFile(cacheFile, 'utf-8');

      expect(content).toBeDefined();
    });

    it('should overwrite existing cache file', async () => {
      const error1 = aCachedError({
        name: 'FirstError',
        message: 'First',
        commandName: 'test1',
        timestamp: 1000,
      });

      const error2 = aCachedError({
        name: 'SecondError',
        message: 'Second',
        commandName: 'test2',
        timestamp: 2000,
      });

      await errorCache.write(error1);
      await errorCache.write(error2);

      const cached = await errorCache.read();
      expect(cached?.name).toBe('SecondError');
      expect(cached?.timestamp).toBe(2000);
    });

    it.skipIf(process.platform === 'win32')(
      'should make the cache file readable by its owner only, even when it already existed',
      async () => {
        const cacheFile = join(tempDir, 'last_error.json');
        // A file an older version left behind; chmod because the umask may
        // have narrowed writeFile's mode.
        await writeFile(cacheFile, '{}');
        await chmod(cacheFile, 0o644);

        await errorCache.write(aCachedError());

        expect((await stat(cacheFile)).mode & 0o777).toBe(0o600);
        expect((await errorCache.read())?.name).toBe('TestError');
      },
    );

    it.skipIf(process.platform === 'win32')(
      'should create the cache file readable by its owner only',
      async () => {
        // The path of every fresh install: there is no file to chmod yet.
        await errorCache.write(aCachedError());

        const cacheFile = join(tempDir, 'last_error.json');
        expect((await stat(cacheFile)).mode & 0o777).toBe(0o600);
      },
    );

    it('should handle write failures gracefully', async () => {
      // Use a null byte in the path to guarantee an invalid path on all OSes.
      // A plain '/invalid/...' path may be writable on Windows because it resolves
      // to the current drive root (for example, C:\invalid\...).
      const invalidCache = new ErrorCache('/invalid/\0/path');
      const error = aCachedError();

      // Should not throw
      await expect(invalidCache.write(error)).resolves.toBeUndefined();
    });

    it('should include optional fields', async () => {
      const error = aCachedError({
        message: 'Test error',
        stack: 'Error: Test\n  at test.ts:10',
        cause: { reason: 'underlying cause' },
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
      });

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
      const error = aCachedError({
        name: 'ReadTestError',
        message: 'Read test',
        commandName: 'read:test',
        timestamp: 123456,
        argv: ['test'],
      });

      await errorCache.write(error);
      const cached = await errorCache.read();

      expect(cached).toEqual(error);
      await expect(
        stat(join(tempDir, 'last_error.json')),
      ).resolves.toBeDefined();
      expect(await errorCache.read()).toEqual(error);
    });

    // Anything the CLI cannot vouch for as redacted is deleted on sight, so
    // nothing from it can leave the machine through `thymian feedback`.
    it.each([
      [
        'a record written before redaction, without a record version',
        JSON.stringify({
          name: 'OldError',
          message: 'Invalid option: "some-plugin.auth.token=ghp_s3cr3t"',
          commandName: 'lint',
          timestamp: 1000,
          argv: ['-o', 'some-plugin.auth.token=ghp_s3cr3t'],
          version: {
            architecture: 'x64',
            cliVersion: '0.3.1',
            nodeVersion: 'v22.0.0',
          },
          pluginVersions: [],
        }),
      ],
      [
        'a record with a lower record version',
        JSON.stringify({
          recordVersion: 0,
          name: 'OddError',
          message: 'Odd',
          commandName: 'lint',
          timestamp: 1000,
          argv: [],
          version: {
            architecture: 'x64',
            cliVersion: '1.0.0',
            nodeVersion: 'v22.0.0',
          },
          pluginVersions: [],
        }),
      ],
      [
        'a record whose record version is a string',
        JSON.stringify({
          recordVersion: '1',
          name: 'OddError',
          message: 'Odd',
          commandName: 'lint',
          timestamp: 1000,
          argv: [],
          version: {
            architecture: 'x64',
            cliVersion: '1.0.0',
            nodeVersion: 'v22.0.0',
          },
          pluginVersions: [],
        }),
      ],
      [
        'a record whose record version is not an integer',
        JSON.stringify({
          recordVersion: 1.5,
          name: 'OddError',
          message: 'Odd',
          commandName: 'lint',
          timestamp: 1000,
          argv: [],
          version: {
            architecture: 'x64',
            cliVersion: '1.0.0',
            nodeVersion: 'v22.0.0',
          },
          pluginVersions: [],
        }),
      ],
      ['a file that does not parse', '{ invalid json }'],
      ['a file holding JSON null', 'null'],
    ])(
      'should return undefined and delete the file for %s',
      async (_case, content) => {
        const cacheFile = join(tempDir, 'last_error.json');
        await writeFile(cacheFile, content);

        const result = await errorCache.read();

        expect(result).toBeUndefined();
        await expect(stat(cacheFile)).rejects.toMatchObject({
          code: 'ENOENT',
        });
      },
    );

    it('should return undefined and keep the file for a record a newer CLI wrote', async () => {
      const cacheFile = join(tempDir, 'last_error.json');
      const content = JSON.stringify({
        recordVersion: ERROR_RECORD_VERSION + 1,
        name: 'NewerError',
        message: 'From a newer CLI',
        commandName: 'lint',
        timestamp: 1000,
        argv: [],
        version: {
          architecture: 'x64',
          cliVersion: '9.0.0',
          nodeVersion: 'v22.0.0',
        },
        pluginVersions: [],
      });
      await writeFile(cacheFile, content);

      const result = await errorCache.read();

      expect(result).toBeUndefined();
      expect(await readFile(cacheFile, 'utf-8')).toBe(content);
    });

    it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
      'should make a record it cannot delete readable by its owner only',
      async () => {
        const cacheFile = join(tempDir, 'last_error.json');
        // A record written before redaction, at the mode an older version left.
        await writeFile(
          cacheFile,
          JSON.stringify({
            name: 'OldError',
            message: 'Invalid option: "some-plugin.auth.token=ghp_s3cr3t"',
            commandName: 'lint',
            timestamp: 1000,
            argv: ['-o', 'some-plugin.auth.token=ghp_s3cr3t'],
            version: {
              architecture: 'x64',
              cliVersion: '0.3.1',
              nodeVersion: 'v22.0.0',
            },
            pluginVersions: [],
          }),
        );
        await chmod(cacheFile, 0o644);
        // Without write permission on the directory the file cannot be deleted.
        await chmod(tempDir, 0o500);

        try {
          const result = await errorCache.read();

          expect(result).toBeUndefined();
          expect((await stat(cacheFile)).mode & 0o777).toBe(0o600);
        } finally {
          await chmod(tempDir, 0o700);
        }
      },
    );

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
      const error = aCachedError();

      await errorCache.write(error);
      expect(await errorCache.read()).toBeDefined();

      await errorCache.reset();

      expect(await errorCache.read()).toBeUndefined();
    });

    it('should handle missing file when resetting', async () => {
      await expect(errorCache.reset()).resolves.toBeUndefined();
    });

    it('should reject on an error other than a missing file', async () => {
      // A null byte makes the path invalid on all OSes, as in the tests above.
      const invalidCache = new ErrorCache('/invalid/\0/path');

      await expect(invalidCache.reset()).rejects.toThrow();
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
