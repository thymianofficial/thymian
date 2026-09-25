import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureOutput } from '@oclif/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Sync from '../src/cli/commands/sampler/sync.js';
import Validate from '../src/cli/commands/sampler/validate.js';

// `Config.load` needs a real oclif-describable root to resolve against.
// `@thymian/plugin-sampler`'s own `package.json` carries an `oclif` field
// (commands + topics), so it stands in for the CLI root the way
// `packages/thymian` does for its own command tests.
process.env.OCLIF_TEST_ROOT = fileURLToPath(new URL('..', import.meta.url));

type SyncResult = { changed: string[]; wrote: boolean; rewritten?: string[] };
type ValidateReport = {
  verdict: 'ok' | 'stale' | 'broken' | 'drifted';
  surface: 'absent' | 'in-sync' | 'behind';
  warnings: string[];
  unresolved: never[];
  conflicts: never[];
  unexported: never[];
  typeErrors: never[];
  changedFiles: string[];
};

/**
 * What each test controls: the canned reply to the one action the command
 * under test emits. Isolates the exit-code/control-flow fix (#131) from the
 * real `sampler.sync`/`sampler.validate` action logic, which is exercised
 * against the real plugin in `test/drift-gate.test.ts`.
 */
const mockState: {
  syncResult?: SyncResult;
  validateReport?: ValidateReport;
} = {};

vi.mock('@thymian/core', async () => {
  const actual =
    await vi.importActual<typeof import('@thymian/core')>('@thymian/core');

  class MockThymian {
    static DEFAULT_TIMEOUT = 30_000;
    static DEFAULT_IDLE_TIMEOUT = 5_000;

    public loadFormat = vi.fn(async () => undefined);
    public run = vi.fn(async (fn: (emitter: unknown) => Promise<unknown>) =>
      fn({
        emitAction: vi.fn(async (name: string) => {
          if (name === 'sampler.sync') {
            return mockState.syncResult;
          }
          if (name === 'sampler.validate') {
            return mockState.validateReport;
          }
          throw new Error(`Unexpected action "${name}" in this test.`);
        }),
      }),
    );
  }

  return { ...actual, Thymian: MockThymian };
});

/**
 * #131: a legitimate gate failure in human mode must set the exit code and
 * return normally — not throw through `this.exit()`, which routes past this
 * run's teardown and through oclif's error-record/feedback-prompt path
 * (`BaseCliRunCommand.catch`) for what is a verdict, not a crash.
 */
describe('sampler sync / validate: human-mode gate failures', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'thymian-gate-exit-code-'));
    writeFileSync(
      join(tempDir, 'thymian.config.yaml'),
      [
        'specifications:',
        '  - type: openapi',
        '    location: api.yaml',
        'plugins: {}',
      ].join('\n'),
      'utf-8',
    );
    mockState.syncResult = undefined;
    mockState.validateReport = undefined;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
    // These tests set `process.exitCode` as their whole subject — reset it so
    // a real gate failure asserted here does not leak into the test runner's
    // own exit code.
    process.exitCode = undefined;
  });

  describe('sampler sync --check', () => {
    it('sets the exit code and returns the result, without throwing', async () => {
      mockState.syncResult = { changed: ['request-types.d.ts'], wrote: false };

      const { error, stdout } = await captureOutput(async () => {
        await Sync.run(['--check', '--cwd', tempDir, '--no-autoload']);
      });

      // The defect this closes: `this.exit(1)` throws an oclif ExitError that
      // this command's `catch()` re-raises past `BaseCliRunCommand.catch`,
      // which is what `error` being set here would mean.
      expect(error).toBeUndefined();
      expect(process.exitCode).toBe(1);
      expect(stdout).toContain('out of sync');
      expect(stdout).toContain('request-types.d.ts');
    });

    it('sets no exit code when nothing is out of sync', async () => {
      mockState.syncResult = { changed: [], wrote: false };

      const { error } = await captureOutput(async () => {
        process.exitCode = undefined;
        await Sync.run(['--check', '--cwd', tempDir, '--no-autoload']);
      });

      expect(error).toBeUndefined();
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('sampler validate', () => {
    it('sets the exit code and returns the report for a "drifted" verdict, without throwing', async () => {
      mockState.validateReport = {
        verdict: 'drifted',
        surface: 'behind',
        warnings: [],
        unresolved: [],
        conflicts: [],
        unexported: [],
        typeErrors: [],
        changedFiles: [],
      };

      const { error, stdout } = await captureOutput(async () => {
        await Validate.run(['--cwd', tempDir, '--no-autoload']);
      });

      expect(error).toBeUndefined();
      expect(process.exitCode).toBe(1);
      expect(stdout).toContain('Breaking drift');
    });

    it('sets the exit code and returns the report for a "broken" verdict, without throwing', async () => {
      mockState.validateReport = {
        verdict: 'broken',
        surface: 'in-sync',
        warnings: [],
        unresolved: [],
        conflicts: [],
        unexported: [],
        typeErrors: [],
        changedFiles: [],
      };

      const { error, stdout } = await captureOutput(async () => {
        await Validate.run(['--cwd', tempDir, '--no-autoload']);
      });

      expect(error).toBeUndefined();
      expect(process.exitCode).toBe(1);
      expect(stdout).toContain('do not compile');
    });

    it('sets no exit code for an "ok" verdict', async () => {
      mockState.validateReport = {
        verdict: 'ok',
        surface: 'absent',
        warnings: [],
        unresolved: [],
        conflicts: [],
        unexported: [],
        typeErrors: [],
        changedFiles: [],
      };

      const { error } = await captureOutput(async () => {
        process.exitCode = undefined;
        await Validate.run(['--cwd', tempDir, '--no-autoload']);
      });

      expect(error).toBeUndefined();
      expect(process.exitCode).toBeUndefined();
    });
  });
});
