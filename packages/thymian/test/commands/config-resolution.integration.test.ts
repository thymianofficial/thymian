import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

// --- Shared mock state ---
const mockState: {
  lintInput?: unknown;
  runCalled?: boolean;
} = {};

vi.mock('@thymian/core', async () => {
  const actual = await vi.importActual('@thymian/core');

  class MockThymian {
    emitter = new EventEmitter();
    static DEFAULT_TIMEOUT = 30_000;
    static DEFAULT_IDLE_TIMEOUT = 5_000;

    public ready = vi.fn(async () => undefined);
    public close = vi.fn(async () => undefined);
    public register = vi.fn();
    public run = vi.fn(async (fn: () => Promise<unknown>) => fn());
    public lint = vi.fn(async (input: unknown) => {
      mockState.lintInput = input;
      mockState.runCalled = true;
      return { outcome: 'pass', results: [] };
    });
  }

  return {
    ...actual,
    Thymian: MockThymian,
  };
});

import Lint from '../../src/commands/lint.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('config resolution chain (integration)', () => {
  let exitSpy: MockInstance<typeof vi.spyOn>;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(__dirname, '__tmp_config_resolution__');
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
    mockState.lintInput = undefined;
    mockState.runCalled = false;
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------
  // Step A: Explicit --config flag
  // -------------------------------------------------------
  describe('Step A: explicit --config flag', () => {
    it('loads config from explicit --config path', async () => {
      const configPath = join(tmpDir, 'explicit.config.yaml');
      writeFileSync(
        configPath,
        [
          'specifications:',
          '  - type: openapi',
          '    location: ./my-api.yaml',
          'plugins:',
          "  '@thymian/openapi': {}",
        ].join('\n'),
      );

      await captureOutput(async () => {
        await Lint.run(['--config', configPath, '--no-autoload']);
      });

      expect(mockState.runCalled).toBe(true);
      expect(mockState.lintInput).toEqual(
        expect.objectContaining({
          specification: [{ type: 'openapi', location: './my-api.yaml' }],
        }),
      );
    });

    it('exits with code 2 when --config path does not exist', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await captureOutput(async () => {
        await Lint.run([
          '--config',
          join(tmpDir, 'nonexistent.config.yaml'),
          '--no-autoload',
        ]);
      });

      expect(exitSpy).toHaveBeenCalledWith(2);
      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------
  // Step B: Auto-probe well-known config in cwd
  // -------------------------------------------------------
  describe('Step B: auto-probe well-known config', () => {
    let cwdDir: string;

    beforeEach(() => {
      cwdDir = join(tmpDir, 'auto-probe');
      if (existsSync(cwdDir)) {
        rmSync(cwdDir, { recursive: true });
      }
      mkdirSync(cwdDir, { recursive: true });
    });

    it('auto-discovers thymian.config.yaml in cwd', async () => {
      writeFileSync(
        join(cwdDir, 'thymian.config.yaml'),
        [
          'specifications:',
          '  - type: openapi',
          '    location: ./auto-discovered.yaml',
          'plugins:',
          "  '@thymian/openapi': {}",
        ].join('\n'),
      );

      await captureOutput(async () => {
        await Lint.run(['--cwd', cwdDir, '--no-autoload']);
      });

      expect(mockState.runCalled).toBe(true);
      expect(mockState.lintInput).toEqual(
        expect.objectContaining({
          specification: [
            { type: 'openapi', location: './auto-discovered.yaml' },
          ],
        }),
      );
    });

    it('falls back to defaultConfig when no config file exists (triggers spec-search exit)', async () => {
      // No config file in cwdDir, no --spec
      // defaultConfig has empty specifications, so Step D/E/F should trigger
      const { stdout, error } = await captureOutput(async () => {
        await Lint.run(['--cwd', cwdDir, '--no-autoload']);
      });

      // this.exit(2) throws an ExitError during init() after logging guidance.
      expect(error).toBeDefined();
      expect(stdout).toContain('No specification found');
    });
  });

  // -------------------------------------------------------
  // Step C: --spec flag overrides config specifications
  // -------------------------------------------------------
  describe('Step C: --spec overrides config specifications', () => {
    it('--spec replaces config specifications', async () => {
      const configPath = join(tmpDir, 'override.config.yaml');
      writeFileSync(
        configPath,
        [
          'specifications:',
          '  - type: openapi',
          '    location: ./original.yaml',
          'plugins:',
          "  '@thymian/openapi': {}",
        ].join('\n'),
      );

      await captureOutput(async () => {
        await Lint.run([
          '--config',
          configPath,
          '--spec',
          'openapi:./overridden.yaml',
          '--no-autoload',
        ]);
      });

      expect(mockState.runCalled).toBe(true);
      expect(mockState.lintInput).toEqual(
        expect.objectContaining({
          specification: [{ type: 'openapi', location: './overridden.yaml' }],
        }),
      );
    });

    it('--spec without explicit type defaults to openapi', async () => {
      const configPath = join(tmpDir, 'override.config.yaml');

      await captureOutput(async () => {
        await Lint.run([
          '--config',
          configPath,
          '--spec',
          './just-a-path.yaml',
          '--no-autoload',
        ]);
      });

      expect(mockState.runCalled).toBe(true);
      expect(mockState.lintInput).toEqual(
        expect.objectContaining({
          specification: [{ type: 'openapi', location: './just-a-path.yaml' }],
        }),
      );
    });

    it('--spec with no config file uses default config + spec override', async () => {
      const emptyDir = join(tmpDir, 'spec-no-config');
      mkdirSync(emptyDir, { recursive: true });

      await captureOutput(async () => {
        await Lint.run([
          '--cwd',
          emptyDir,
          '--spec',
          'openapi:./my-spec.yaml',
          '--no-autoload',
        ]);
      });

      expect(mockState.runCalled).toBe(true);
      expect(mockState.lintInput).toEqual(
        expect.objectContaining({
          specification: [{ type: 'openapi', location: './my-spec.yaml' }],
        }),
      );
    });
  });

  // -------------------------------------------------------
  // Steps D+E+F: Spec search hook and guidance messages
  // -------------------------------------------------------
  describe('Steps D+E+F: spec search hook and guidance', () => {
    it('exits 2 with guidance when no specs found anywhere', async () => {
      const emptyDir = join(tmpDir, 'no-specs');
      mkdirSync(emptyDir, { recursive: true });

      const { stdout, error } = await captureOutput(async () => {
        await Lint.run(['--cwd', emptyDir, '--no-autoload']);
      });

      // this.exit(2) throws an ExitError during init() after logging guidance.
      expect(error).toBeDefined();
      expect(stdout).toContain('No specification found');
      expect(stdout).toContain('thymian generate config');
      expect(mockState.runCalled).toBe(false);
    });
  });
});
