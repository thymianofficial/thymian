import { existsSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { captureOutput, runCommand } from '@oclif/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

describe('init command', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'thymian-init-test-'));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should run init command in a clean directory', async () => {
    const result = await runCommand(`init --cwd ${testDir} --yes`);

    expect(result.stdout).toContain('CREATED');
    expect(result.stdout).toContain('ADDED');
    expect(result.stdout).toContain('Initialized Thymian');
    expect(existsSync(join(testDir, 'thymian.config.json'))).toBe(true);
  });

  it('should fail when config file already exists without --force flag', async () => {
    // Create an existing config file
    const configPath = join(testDir, 'thymian.config.json');
    writeFileSync(configPath, JSON.stringify({ plugins: {} }));

    const result = await runCommand(`init --cwd ${testDir} --yes`);

    expect(result.error).toBeDefined();
    expect(result.error).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('already exists'),
      }),
    );
  });

  it('should overwrite existing config file when --force flag is used', async () => {
    // Create an existing config file with different content
    const configPath = join(testDir, 'thymian.config.json');
    const oldContent = {
      plugins: {
        testPluginName: {},
      },
    };
    writeFileSync(configPath, JSON.stringify(oldContent));

    await runCommand(`init --cwd ${testDir} --yes --force`);

    const configResult = await runCommand(
      `config:show --cwd ${testDir} --no-autoload`,
    );

    expect(configResult.stdout).not.toContain('testPluginName');
  });

  it('should handle custom config-file name with .json extension', async () => {
    await runCommand(
      `init --cwd ${testDir} --config-file custom-config.json --yes`,
    );

    expect(existsSync(join(testDir, 'custom-config.json'))).toBe(true);
  });

  it('should handle custom config-file name with .yaml extension', async () => {
    await runCommand(
      `init --cwd ${testDir} --config-file custom-config.yaml --yes`,
    );

    expect(existsSync(join(testDir, 'custom-config.yaml'))).toBe(true);
  });

  it('should create yaml config file when --yaml-format flag is used', async () => {
    const r = await runCommand(`init --cwd ${testDir} --yaml-format --yes`);

    expect(existsSync(join(testDir, 'thymian.config.yaml'))).toBe(true);
  });

  it('should create yaml config file with custom name when both --yaml-format and --config-file are used', async () => {
    const result = await captureOutput(async () => {
      await runCommand(
        `init --cwd ${testDir} --config-file my-thymian.yaml --yaml-format --yes`,
      );
    });

    expect(existsSync(join(testDir, 'my-thymian.yaml'))).toBe(true);
  });
});
