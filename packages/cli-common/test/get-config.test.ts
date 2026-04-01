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

  describe('options-based API', () => {
    it('should return default config when called with no options', async () => {
      const config = await getConfig({ cwd: tempDir });

      expect(config).toEqual(defaultConfig);
    });

    it('should return default config when called with empty options', async () => {
      const config = await getConfig({});

      expect(config).toEqual(defaultConfig);
    });
  });

  describe('explicit --config path (Step A)', () => {
    it('should load config from explicit configPath', async () => {
      const configContent: ThymianConfig = {
        plugins: {
          '@thymian/openapi': {
            path: './openapi.yaml',
          },
        },
      };

      await writeFile(
        join(tempDir, 'custom-config.json'),
        JSON.stringify(configContent),
      );

      const config = await getConfig({
        configPath: 'custom-config.json',
        cwd: tempDir,
      });

      expect(config).toEqual(configContent);
    });

    it('should load config from absolute configPath', async () => {
      const configContent: ThymianConfig = {
        plugins: { test: {} },
      };

      const absolutePath = join(tempDir, 'absolute-config.json');
      await writeFile(absolutePath, JSON.stringify(configContent));

      const config = await getConfig({
        configPath: absolutePath,
        cwd: tempDir,
      });

      expect(config.plugins).toHaveProperty('test');
    });

    it('should exit 2 when explicit configPath does not exist', async () => {
      await expect(
        getConfig({ configPath: 'missing.yaml', cwd: tempDir }),
      ).rejects.toThrow('process.exit called with code 2');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Config not found at'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });
  });

  describe('auto-probe well-known files (Step B)', () => {
    it('should auto-detect thymian.config.yaml in cwd', async () => {
      const yamlContent = `
plugins:
  '@thymian/openapi':
    path: ./openapi.yaml
`;
      await writeFile(join(tempDir, 'thymian.config.yaml'), yamlContent);

      const config = await getConfig({ cwd: tempDir });

      expect(config.plugins).toHaveProperty('@thymian/openapi');
    });

    it('should ignore thymian.config.yml and thymian.config.json during auto-probe', async () => {
      const ymlContent = `
plugins:
  picked-yml: {}
`;
      const jsonContent: ThymianConfig = { plugins: { 'picked-json': {} } };

      await writeFile(join(tempDir, 'thymian.config.yml'), ymlContent);
      await writeFile(
        join(tempDir, 'thymian.config.json'),
        JSON.stringify(jsonContent),
      );

      const config = await getConfig({ cwd: tempDir });

      expect(config).toEqual(defaultConfig);
    });

    it('should return defaultConfig when no well-known file exists', async () => {
      const config = await getConfig({ cwd: tempDir });

      expect(config).toEqual(defaultConfig);
    });
  });

  describe('config file loading', () => {
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

      const config = await getConfig({ configPath, cwd: tempDir });

      expect(config).toEqual(configContent);
    });

    it('should load valid YAML config', async () => {
      const yamlContent = `
plugins:
  '@thymian/openapi':
    path: ./openapi.yaml
`;

      await writeFile(join(tempDir, 'thymian.config.yaml'), yamlContent);

      const config = await getConfig({ cwd: tempDir });

      expect(config.plugins).toHaveProperty('@thymian/openapi');
      expect(config.plugins['@thymian/openapi']).toEqual({
        path: './openapi.yaml',
      });
    });

    it('should load config with autoload field', async () => {
      const configContent: ThymianConfig = {
        autoload: true,
        plugins: {},
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig({ configPath, cwd: tempDir });

      expect(config.autoload).toBe(true);
    });

    it('should load config with specifications array', async () => {
      const configContent: ThymianConfig = {
        plugins: {},
        specifications: [{ type: 'openapi', location: './openapi.yaml' }],
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig({ configPath, cwd: tempDir });

      expect(config.specifications).toBeDefined();
      expect(config.specifications).toHaveLength(1);
    });

    it('should load config with empty plugins object', async () => {
      const configContent: ThymianConfig = {
        plugins: {},
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(configContent));

      const config = await getConfig({ configPath, cwd: tempDir });

      expect(config.plugins).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should exit process with code 2 on invalid JSON', async () => {
      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, '{ invalid json }');

      await expect(getConfig({ configPath, cwd: tempDir })).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should exit process with code 2 on invalid YAML', async () => {
      await writeFile(
        join(tempDir, 'thymian.config.yaml'),
        'invalid:\n  - yaml\n  content:\nbroken',
      );

      await expect(getConfig({ cwd: tempDir })).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should exit process with code 2 on validation failure', async () => {
      const invalidConfig = {
        autoload: 'invalid-type',
      };

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(getConfig({ configPath, cwd: tempDir })).rejects.toThrow(
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

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(getConfig({ configPath, cwd: tempDir })).rejects.toThrow(
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

      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(getConfig({ configPath, cwd: tempDir })).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw error for unsupported file extension', async () => {
      await writeFile(join(tempDir, 'config.txt'), 'some content');

      await expect(
        getConfig({ configPath: 'config.txt', cwd: tempDir }),
      ).rejects.toThrow('process.exit called with code 2');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle missing required fields', async () => {
      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, JSON.stringify({ autoload: true }));

      await expect(getConfig({ configPath, cwd: tempDir })).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle empty JSON file', async () => {
      const configPath = join(tempDir, 'thymian.config.json');
      await writeFile(configPath, '{}');

      await expect(getConfig({ configPath, cwd: tempDir })).rejects.toThrow(
        'process.exit called with code 2',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });
  });
});
