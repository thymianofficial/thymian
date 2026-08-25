import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { NoopLogger, type Report, ThymianBaseError } from '@thymian/core';
import { describe, expect, it, vitest } from 'vitest';

import { FORMATTER_REGISTRY, getFormatters } from '../src/get-formatters.js';

const pluginOptions = { cwd: '/base', logger: new NoopLogger() };

function reportFixture(overrides: Partial<Report> = {}): Report {
  return {
    reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
    createdAt: '2026-08-25T10:30:00.123Z',
    runs: [],
    ...overrides,
  };
}

describe.each(['markdown', 'csv', 'json'] as const)(
  'FORMATTER_REGISTRY.%s.prepareOptions',
  (name) => {
    it('passes cwd down and leaves reportsDir at its default', () => {
      const prepared = FORMATTER_REGISTRY[name].prepareOptions(
        {},
        pluginOptions,
      );

      // Nothing is resolved here: the run directory is derived from a report's
      // own identity, and no report exists yet.
      expect(prepared.cwd).toBe('/base');
      expect(prepared.reportsDir).toBeUndefined();
    });

    it('passes a configured reportsDir down verbatim', () => {
      const prepared = FORMATTER_REGISTRY[name].prepareOptions(
        {},
        {
          ...pluginOptions,
          reportsDir: 'build/rep',
        },
      );

      expect(prepared.reportsDir).toBe('build/rep');
      expect(prepared.cwd).toBe('/base');
    });
  },
);

describe('getFormatters reportsDir', () => {
  async function runDirectoriesUnder(
    reportsDir: string | undefined,
    base: string,
    cwd: string,
  ): Promise<string[]> {
    const formatters = await getFormatters(
      { markdown: {}, csv: {}, json: {} },
      cwd,
      new NoopLogger(),
      undefined,
      reportsDir,
    );

    for (const formatter of formatters) {
      await formatter.report(reportFixture());
      await formatter.flush();
    }

    return readdir(base);
  }

  it('resolves a relative reportsDir against the run cwd', async () => {
    const cwd = join(process.cwd(), 'tmp', 'get-formatters-relative-base');
    await rm(cwd, { recursive: true, force: true });

    const runDirectories = await runDirectoriesUnder(
      'build/rep',
      join(cwd, 'build', 'rep'),
      cwd,
    );

    const [runDirectory = ''] = runDirectories;

    expect(runDirectories).toEqual(['2026-08-25T10-30-00-123Z-a1b2c3d4']);
    expect(
      (await readdir(join(cwd, 'build', 'rep', runDirectory))).sort(),
    ).toEqual(['report.csv', 'report.json', 'report.md']);
    // A custom base takes over completely — nothing is left in the default one.
    await expect(readdir(join(cwd, '.thymian'))).rejects.toThrow();
  });

  it('uses an absolute reportsDir as-is, ignoring cwd', async () => {
    const cwd = join(process.cwd(), 'tmp', 'get-formatters-absolute-base');
    await rm(cwd, { recursive: true, force: true });
    const absoluteBase = await mkdtemp(join(tmpdir(), 'thymian-reports-'));

    try {
      const runDirectories = await runDirectoriesUnder(
        absoluteBase,
        absoluteBase,
        cwd,
      );

      expect(runDirectories).toEqual(['2026-08-25T10-30-00-123Z-a1b2c3d4']);
      await expect(readdir(cwd)).rejects.toThrow();
    } finally {
      await rm(absoluteBase, { recursive: true, force: true });
    }
  });
});

/** The run directory {@link reportFixture} derives, spelled out. */
const RUN_DIRECTORY = '2026-08-25T10-30-00-123Z-a1b2c3d4';

/** A scratch `cwd` of its own per test, so run directories cannot collide. */
async function freshCwd(name: string): Promise<string> {
  const cwd = join(process.cwd(), 'tmp', name);
  await rm(cwd, { recursive: true, force: true });

  return cwd;
}

/**
 * A `cwd` whose report base directory cannot be created, portably: put an
 * existing *file* where a directory has to go, so `mkdir` fails with `ENOTDIR`.
 * `chmod` would be no help — it is a no-op for root (CI containers) and
 * unsupported on Windows.
 */
async function blockingFile(name: string): Promise<string> {
  const blocker = join(process.cwd(), 'tmp', name);
  await rm(blocker, { force: true, recursive: true });
  await mkdir(dirname(blocker), { recursive: true });
  await writeFile(blocker, 'this is a file, not a directory', 'utf-8');

  return blocker;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to reject, but it resolved');
    },
    (error: unknown) => error,
  );
}

describe('getFormatters reports directory precondition', () => {
  it('rejects at registration time when the base directory cannot be created', async () => {
    // Registration is awaited while the plugin registers, so this surfaces as a
    // PluginRegistrationError and exits before any workflow runs — instead of
    // one stderr line per report and a green, empty CI run.
    const cwd = await blockingFile('get-formatters-blocked-base');

    const error = await rejection(
      getFormatters({ markdown: {} }, cwd, new NoopLogger()),
    );

    expect(error).toBeInstanceOf(ThymianBaseError);
    const thymianError = error as ThymianBaseError;
    expect(thymianError.name).toBe('UnusableReportsDirectoryError');
    // The message names the directory that could not be created and why.
    expect(thymianError.message).toContain(join(cwd, '.thymian', 'reports'));
    expect(thymianError.message).toMatch(/ENOTDIR|ENOENT/);
    expect(thymianError.options.ref).toBe(
      'https://thymian.dev/references/errors/unusable-reports-directory-error/',
    );
    expect(thymianError.options.suggestions).toEqual(
      expect.arrayContaining([expect.stringContaining('reportsDir')]),
    );
  });

  it('reports the configured reportsDir, not the default, when that is what fails', async () => {
    const cwd = await blockingFile('get-formatters-blocked-custom-base');

    const error = await rejection(
      getFormatters(
        { json: {} },
        cwd,
        new NoopLogger(),
        undefined,
        'build/rep',
      ),
    );

    expect((error as ThymianBaseError).message).toContain(
      join(cwd, 'build', 'rep'),
    );
  });

  it('creates the shared base directory once, before any report exists', async () => {
    const cwd = await freshCwd('get-formatters-eager-base');

    await getFormatters(
      { markdown: {}, csv: {}, json: {} },
      cwd,
      new NoopLogger(),
      undefined,
      'build/rep',
    );

    // One base for all three formatters, and still empty: run directories are
    // derived per report, which does not exist yet.
    expect((await stat(join(cwd, 'build', 'rep'))).isDirectory()).toBe(true);
    expect(await readdir(join(cwd, 'build', 'rep'))).toEqual([]);
  });

  it('runs no check and creates no directory when no formatter is configured', async () => {
    const cwd = await freshCwd('get-formatters-no-formatters');

    await expect(getFormatters({}, cwd, new NoopLogger())).resolves.toEqual([]);

    // Nothing was written, so nothing was created — not even the base.
    await expect(readdir(cwd)).rejects.toThrow();
  });

  it('does not fail on an unusable base when no formatter is configured', async () => {
    // The default config ships `formatters: {}`; a run that emits no report
    // must not care whether the base directory could have been created.
    const cwd = await blockingFile('get-formatters-no-formatters-blocked');

    await expect(getFormatters({}, cwd, new NoopLogger())).resolves.toEqual([]);
  });

  it('still degrades an in-flight write failure instead of throwing', async () => {
    // The asymmetry is deliberate: the up-front precondition fails hard, but by
    // the time a report is being written its findings exist and aborting would
    // destroy them. Base directory fine, run directory blocked.
    const cwd = await freshCwd('get-formatters-in-flight-failure');
    const base = join(cwd, '.thymian', 'reports');
    await mkdir(base, { recursive: true });
    await writeFile(join(base, RUN_DIRECTORY), 'not a directory', 'utf-8');

    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');

    const [formatter] = await getFormatters({ markdown: {} }, cwd, logger);
    if (formatter === undefined) {
      throw new Error(
        'expected getFormatters to return the markdown formatter',
      );
    }

    await expect(formatter.report(reportFixture())).resolves.toBeUndefined();
    await expect(formatter.flush()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write Markdown report to'),
    );
  });
});
