import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultConfig } from '../src/default-config.js';
import { getConfig } from '../src/get-config.js';
import type { ThymianConfig } from '../src/thymian-config.js';

describe('get-config', () => {
  let tempDir: string;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'thymian-test-'));
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number) => {
        throw new Error(`process.exit called with code ${code}`);
      });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('happy path', () => {
    it('should return default config when file does not exist', async () => {
      const config = await getConfig('non-existent.yaml', tempDir);

      expect(config).toEqual(defaultConfig);
    });

    it('should load valid JSON config', async () => {
      const configContent: ThymianConfig = {
        plugins: {
          '@thymian/openapi': {
            path: './openapi.yaml',
          },
        },
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig('thymian.config.json', tempDir);

      expect(config).toEqual(configContent);
    });

    it('should load valid YAML config', async () => {
      const yamlContent = `
plugins:
  '@thymian/openapi':
    path: ./openapi.yaml
`;

      const configPath = join(tempDir, 'thymian.config.yaml');
      await writeFile(configPath, yamlContent);

      const config = await getConfig('thymian.config.yaml', tempDir);

      expect(config.plugins).toHaveProperty('@thymian/openapi');
      expect(config.plugins['@thymian/openapi']).toEqual({
        path: './openapi.yaml',
      });
    });

    it('should load valid YML config', async () => {
      const yamlContent = `
plugins:
  '@thymian/reporter':
    options:
      formatters:
        cli: {}
`;

      const configPath = join(tempDir, 'thymian.config.yml');
      await writeFile(configPath, yamlContent);

      const config = await getConfig('thymian.config.yml', tempDir);

      expect(config.plugins).toHaveProperty('@thymian/reporter');
    });

    it('should load config with autoload field', async () => {
      const configContent: ThymianConfig = {
        autoload: true,
        plugins: {},
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig('thymian.config.json', tempDir);

      expect(config.autoload).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should load config with specifications array', async () => {
      const configContent: ThymianConfig = {
        plugins: {},
        specifications: [{ type: 'openapi', location: './openapi.yaml' }],
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig('thymian.config.json', tempDir);

      expect(config.specifications).toBeDefined();
      expect(config.specifications).toHaveLength(1);
    });

    it('should load config with empty plugins object', async () => {
      const configContent: ThymianConfig = {
        plugins: {},
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig('thymian.config.json', tempDir);

      expect(config.plugins).toEqual({});
    });

    it('should load config from custom cwd', async () => {
      const configContent: ThymianConfig = {
        plugins: {
          test: {},
        },
      };

      const configPath = join(tempDir, 'custom.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig('custom.json', tempDir);

      expect(config.plugins).toHaveProperty('test');
    });

    it('should handle empty JSON file', async () => {
      const configPath = join(tempDir, 'empty.json');
      await writeFile(configPath, '{}');

      await expect(getConfig('empty.json', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });
  });

  describe('error handling', () => {
    it('should exit process with code 2 on invalid JSON', async () => {
      const configPath = join(tempDir, 'invalid.json');
      await writeFile(configPath, '{ invalid json }');

      await expect(getConfig('invalid.json', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should exit process with code 2 on invalid YAML', async () => {
      const configPath = join(tempDir, 'invalid.yaml');
      await writeFile(configPath, 'invalid:\n  - yaml\n  content:\nbroken');

      await expect(getConfig('invalid.yaml', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should exit process with code 2 on validation failure', async () => {
      const invalidConfig = {
        autoload: 'invalid-type',
      };

      const configPath = join(tempDir, 'validation-fail.json');
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(getConfig('validation-fail.json', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot run Thymian CLI because of:'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should log error message on validation failure', async () => {
      const invalidConfig = {
        plugins: 'not-an-object',
      };

      const configPath = join(tempDir, 'bad-config.json');
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(getConfig('bad-config.json', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid Thymian config'),
      );
    });

    it('should log validation error cause', async () => {
      const invalidConfig = {
        plugins: {},
        unknownField: 'value',
      };

      const configPath = join(tempDir, 'extra-field.json');
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(getConfig('extra-field.json', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw error for unsupported file extension', async () => {
      const configPath = join(tempDir, 'config.txt');
      await writeFile(configPath, 'some content');

      await expect(getConfig('config.txt', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle missing required fields', async () => {
      const configPath = join(tempDir, 'missing-plugins.json');
      await writeFile(configPath, JSON.stringify({ autoload: true }));

      await expect(getConfig('missing-plugins.json', tempDir)).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });
  });
});
