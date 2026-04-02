import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureOutput } from '@oclif/test';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { parse } from 'yaml';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

import GenerateConfig from '../../src/commands/generate/config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Helper to read and parse a generated YAML config file.
 */
async function loadGeneratedConfig(
  filePath: string,
): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, 'utf-8');
  return parse(content) as Record<string, unknown>;
}

describe('generate config (integration)', () => {
  let exitSpy: MockInstance<typeof vi.spyOn>;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(__dirname, '__tmp_generate_config__');
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  });

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as () => never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('--no-interactive mode', () => {
    it('generates a config file when a single OpenAPI spec is detected', async () => {
      const testDir = join(tmpDir, 'single-spec');
      mkdirSync(testDir, { recursive: true });

      // Create a minimal OpenAPI file that the regex can detect.
      // The searchForOpenApiFiles regex requires `openapi` at the start of a line.
      writeFileSync(
        join(testDir, 'petstore.yaml'),
        [
          'openapi: "3.0.0"',
          'info:',
          '  title: Petstore',
          '  version: 1.0.0',
          'paths: {}',
        ].join('\n'),
      );

      const { stdout } = await captureOutput(async () => {
        await GenerateConfig.run(['--cwd', testDir, '--no-interactive']);
      });

      expect(stdout).toContain('Configuration written to');

      // Verify file was created
      const configPath = join(testDir, 'thymian.config.yaml');
      expect(existsSync(configPath)).toBe(true);

      // Round-trip: parse the generated YAML and verify its content
      const loadedConfig = await loadGeneratedConfig(configPath);
      expect(loadedConfig.specifications).toBeDefined();
      expect(loadedConfig.specifications).toHaveLength(1);
      expect(
        (
          loadedConfig.specifications as { type: string; location: string }[]
        )[0],
      ).toEqual(
        expect.objectContaining({
          type: 'openapi',
          location: 'petstore.yaml',
        }),
      );
      expect(loadedConfig.plugins).toBeDefined();
    });

    it('generates a config file at a custom --output path', async () => {
      const testDir = join(tmpDir, 'custom-output');
      mkdirSync(testDir, { recursive: true });

      writeFileSync(
        join(testDir, 'api.yaml'),
        [
          'openapi: "3.1.0"',
          'info:',
          '  title: My API',
          '  version: 2.0.0',
          'paths: {}',
        ].join('\n'),
      );

      const { stdout } = await captureOutput(async () => {
        await GenerateConfig.run([
          '--cwd',
          testDir,
          '--no-interactive',
          '--output',
          'my-api.config.yaml',
        ]);
      });

      expect(stdout).toContain('Configuration written to');

      const configPath = join(testDir, 'my-api.config.yaml');
      expect(existsSync(configPath)).toBe(true);

      // Round-trip: verify generated config has specifications
      const loadedConfig = await loadGeneratedConfig(configPath);
      expect(loadedConfig.specifications).toHaveLength(1);
    });

    it('returns error when no OpenAPI files detected in --no-interactive mode', async () => {
      const testDir = join(tmpDir, 'no-specs');
      mkdirSync(testDir, { recursive: true });

      // Create a non-OpenAPI file to ensure nothing is detected
      writeFileSync(join(testDir, 'readme.md'), '# Not an API spec');

      const { error } = await captureOutput(async () => {
        await GenerateConfig.run(['--cwd', testDir, '--no-interactive']);
      });

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No OpenAPI\/Swagger files detected/);
    });

    it('returns error when config already exists without --output in --no-interactive mode', async () => {
      const testDir = join(tmpDir, 'existing-config');
      mkdirSync(testDir, { recursive: true });

      // Create an existing config
      writeFileSync(
        join(testDir, 'thymian.config.yaml'),
        'plugins:\n  "@thymian/openapi": {}\n',
      );

      // Create a spec so detection doesn't fail first
      writeFileSync(
        join(testDir, 'api.yaml'),
        'openapi: "3.0.0"\ninfo:\n  title: API\n  version: 1.0.0\npaths: {}\n',
      );

      const { error } = await captureOutput(async () => {
        await GenerateConfig.run(['--cwd', testDir, '--no-interactive']);
      });

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Configuration file already exists/);
    });
  });

  describe('--for-spec flag', () => {
    it('generates config with the provided spec, skipping auto-detection', async () => {
      const testDir = join(tmpDir, 'for-spec');
      mkdirSync(testDir, { recursive: true });

      const { stdout } = await captureOutput(async () => {
        await GenerateConfig.run([
          '--cwd',
          testDir,
          '--no-interactive',
          '--for-spec',
          'openapi:./petstore.yaml',
        ]);
      });

      expect(stdout).toContain('Configuration written to');

      const configPath = join(testDir, 'thymian.config.yaml');
      expect(existsSync(configPath)).toBe(true);

      const loadedConfig = await loadGeneratedConfig(configPath);
      expect(loadedConfig.specifications).toHaveLength(1);
      expect(
        (
          loadedConfig.specifications as { type: string; location: string }[]
        )[0],
      ).toEqual({
        type: 'openapi',
        location: './petstore.yaml',
      });
    });

    it('generates config with --for-spec even when no spec files exist in cwd', async () => {
      const testDir = join(tmpDir, 'for-spec-no-files');
      mkdirSync(testDir, { recursive: true });

      // No OpenAPI files in this directory

      const { stdout } = await captureOutput(async () => {
        await GenerateConfig.run([
          '--cwd',
          testDir,
          '--no-interactive',
          '--for-spec',
          'openapi:./my-api.yaml',
        ]);
      });

      expect(stdout).toContain('Configuration written to');

      const configPath = join(testDir, 'thymian.config.yaml');
      expect(existsSync(configPath)).toBe(true);

      const loadedConfig = await loadGeneratedConfig(configPath);
      expect(loadedConfig.specifications).toHaveLength(1);
      expect(
        (
          loadedConfig.specifications as { type: string; location: string }[]
        )[0],
      ).toEqual({
        type: 'openapi',
        location: './my-api.yaml',
      });
    });

    it('--for-spec with explicit type uses the provided type', async () => {
      const testDir = join(tmpDir, 'for-spec-no-type');
      mkdirSync(testDir, { recursive: true });

      const { stdout } = await captureOutput(async () => {
        await GenerateConfig.run([
          '--cwd',
          testDir,
          '--no-interactive',
          '--for-spec',
          'openapi:./api.yaml',
        ]);
      });

      expect(stdout).toContain('Configuration written to');

      const configPath = join(testDir, 'thymian.config.yaml');
      const loadedConfig = await loadGeneratedConfig(configPath);
      expect(
        (
          loadedConfig.specifications as { type: string; location: string }[]
        )[0],
      ).toEqual({
        type: 'openapi',
        location: './api.yaml',
      });
    });
  });

  describe('generated config content', () => {
    it('produces valid YAML with comment header', async () => {
      const testDir = join(tmpDir, 'yaml-content');
      mkdirSync(testDir, { recursive: true });

      writeFileSync(
        join(testDir, 'openapi.yaml'),
        'openapi: "3.0.0"\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      await captureOutput(async () => {
        await GenerateConfig.run(['--cwd', testDir, '--no-interactive']);
      });

      const configContent = await readFile(
        join(testDir, 'thymian.config.yaml'),
        'utf-8',
      );

      // Verify comment header
      expect(configContent).toContain('# Thymian Configuration');
      expect(configContent).toContain(
        '# Generated by `thymian generate config`',
      );
      expect(configContent).toContain('thymian lint');

      // Verify YAML structure contains expected keys
      expect(configContent).toContain('specifications:');
      expect(configContent).toContain('plugins:');
      expect(configContent).toContain('ruleSets:');
    });

    it('includes default plugins in generated config', async () => {
      const testDir = join(tmpDir, 'default-plugins');
      mkdirSync(testDir, { recursive: true });

      writeFileSync(
        join(testDir, 'spec.yaml'),
        'openapi: "3.0.0"\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      await captureOutput(async () => {
        await GenerateConfig.run(['--cwd', testDir, '--no-interactive']);
      });

      const loadedConfig = await loadGeneratedConfig(
        join(testDir, 'thymian.config.yaml'),
      );

      // defaultConfig plugins should be present
      const plugins = loadedConfig.plugins as Record<string, unknown>;
      expect(plugins).toHaveProperty('@thymian/http-linter');
      expect(plugins).toHaveProperty('@thymian/openapi');
      expect(plugins).toHaveProperty('@thymian/reporter');
      expect(plugins).toHaveProperty('@thymian/sampler');
    });
  });
});
