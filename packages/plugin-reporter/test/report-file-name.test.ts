import { readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { NoopLogger, type Report } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { CsvFormatter } from '../src/formatters/csv.js';
import { JsonFormatter } from '../src/formatters/json.js';
import { MarkdownFormatter } from '../src/formatters/markdown.js';
import {
  defaultRunDirectoryName,
  REPORT_BASENAME,
  resolveReportPath,
} from '../src/report-file-name.js';

/**
 * Fixture report with a pinned identity. The naming helper is a pure function of
 * a {@link Report}, so known `reportId`/`createdAt` values are all the coverage
 * it needs — no clock stubbing anywhere.
 */
function reportFixture(overrides: Partial<Report> = {}): Report {
  return {
    reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
    createdAt: '2026-08-25T10:30:00.123Z',
    runs: [],
    ...overrides,
  };
}

describe('defaultRunDirectoryName', () => {
  it('names a run directory after the report timestamp and short id', () => {
    expect(defaultRunDirectoryName(reportFixture())).toBe(
      '2026-08-25T10-30-00-123Z-a1b2c3d4',
    );
  });

  it('never emits a colon, which Windows cannot put in a directory name', () => {
    expect(defaultRunDirectoryName(reportFixture())).not.toContain(':');
  });

  it('is a single path segment with no extension and no dot', () => {
    const name = defaultRunDirectoryName(reportFixture());

    expect(name).not.toContain('.');
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
  });

  it('gives two reports two distinct run directories', () => {
    const first = defaultRunDirectoryName(reportFixture());
    const second = defaultRunDirectoryName(
      reportFixture({
        reportId: '99887766-5544-4332-9110-aabbccddeeff',
        createdAt: '2026-08-25T10:31:00.000Z',
      }),
    );

    expect(second).not.toBe(first);
  });

  it('names a report that produced no findings just like any other', () => {
    expect(defaultRunDirectoryName(reportFixture({ runs: [] }))).toBe(
      '2026-08-25T10-30-00-123Z-a1b2c3d4',
    );
  });

  it('sanitizes a non-ISO createdAt and a non-UUID reportId', () => {
    const name = defaultRunDirectoryName(
      reportFixture({
        reportId: '../../etc/passwd',
        createdAt: 'not a/valid:timestamp',
      }),
    );

    expect(name).toBe('not-a-valid-timestamp-etcpassw');
    expect(name).not.toContain('/');
    expect(name).not.toContain(':');
  });

  it('falls back to the wall clock when createdAt carries nothing usable', () => {
    const name = defaultRunDirectoryName(reportFixture({ createdAt: '' }));

    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-a1b2c3d4$/);
  });

  it('falls back to the wall clock when createdAt is nothing but unsafe characters', () => {
    // Sanitizing *replaces* rather than drops, so ':::' used to survive as
    // '---' and defeat the fallback entirely.
    const name = defaultRunDirectoryName(reportFixture({ createdAt: ':::' }));

    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-a1b2c3d4$/);
    expect(name).not.toContain('--');
  });

  it('leaves a well-formed ISO stamp untouched when collapsing dash runs', () => {
    const name = defaultRunDirectoryName(
      reportFixture({ createdAt: '2026-08-25T10:30:00.123Z' }),
    );

    expect(name).toBe('2026-08-25T10-30-00-123Z-a1b2c3d4');
  });

  it('clamps a pathological createdAt so the name stays inside NAME_MAX', () => {
    const name = defaultRunDirectoryName(
      reportFixture({ createdAt: 'x'.repeat(4096) }),
    );

    expect(name).toBe(`${'x'.repeat(32)}-a1b2c3d4`);
    // Sanitized names are ASCII, so length is byte length: comfortably under
    // the 255-byte NAME_MAX every filesystem we target enforces.
    expect(name.length).toBeLessThan(255);
  });

  it('never leaves a trailing dash behind when it clamps', () => {
    // Sanitizes to 31 'a's, a dash and a 'b' — so the cap lands exactly on the
    // dash and the clamp has to trim it rather than emit 'a…a--a1b2c3d4'.
    const name = defaultRunDirectoryName(
      reportFixture({ createdAt: `${'a'.repeat(31)}:::b` }),
    );

    expect(name).toBe(`${'a'.repeat(31)}-a1b2c3d4`);
    expect(name).not.toContain('--');
  });

  it('falls back to random hex when reportId carries nothing usable', () => {
    const name = defaultRunDirectoryName(reportFixture({ reportId: '' }));

    expect(name).toMatch(/^2026-08-25T10-30-00-123Z-[0-9a-f]{8}$/);
  });

  it('does not throw and stays safe for a missing report', () => {
    const name = defaultRunDirectoryName(undefined);

    expect(name).toMatch(/^[A-Za-z0-9-]+$/);
  });

  it('gives one report object one name even when both fields fall back', () => {
    // Both fallbacks (wall clock, random hex) are call-time, so recomputing
    // them per formatter scattered one run's three files across three
    // directories. The name is memoized against the report instance instead.
    const report = reportFixture({ reportId: '', createdAt: ':::' });

    expect(defaultRunDirectoryName(report)).toBe(
      defaultRunDirectoryName(report),
    );
  });

  it('still gives two distinct report objects two names on the fallback path', () => {
    // Memoization must not turn into a shared name: two reports that cannot
    // name themselves still get a directory each.
    const first = reportFixture({ reportId: '', createdAt: '' });
    const second = reportFixture({ reportId: '', createdAt: '' });

    expect(defaultRunDirectoryName(second)).not.toBe(
      defaultRunDirectoryName(first),
    );
  });
});

describe('resolveReportPath', () => {
  const report = reportFixture();

  it('derives report.<ext> inside a per-run directory under the default base', () => {
    expect(resolveReportPath('/base', undefined, report, 'md')).toBe(
      resolve(
        '/base',
        '.thymian/reports/2026-08-25T10-30-00-123Z-a1b2c3d4/report.md',
      ),
    );
  });

  it('puts every format of one run in the same directory under a stable stem', () => {
    const paths = ['md', 'csv', 'json'].map((extension) =>
      resolveReportPath('/base', undefined, report, extension),
    );

    expect(new Set(paths.map((path) => dirname(path))).size).toBe(1);
    expect(paths.map((path) => path.slice(dirname(path).length + 1))).toEqual([
      `${REPORT_BASENAME}.md`,
      `${REPORT_BASENAME}.csv`,
      `${REPORT_BASENAME}.json`,
    ]);
  });

  it('gives two runs two distinct run directories', () => {
    const first = resolveReportPath('/base', undefined, report, 'md');
    const second = resolveReportPath(
      '/base',
      undefined,
      reportFixture({
        reportId: '99887766-5544-4332-9110-aabbccddeeff',
        createdAt: '2026-08-25T10:31:00.000Z',
      }),
      'md',
    );

    expect(dirname(second)).not.toBe(dirname(first));
    // The basename is stable, so only the directory may distinguish the runs.
    expect(second).not.toBe(first);
  });

  it('anchors a relative reportsDir to cwd, keeping the run directory layout', () => {
    expect(resolveReportPath('/base', 'build/rep', report, 'csv')).toBe(
      resolve(
        '/base',
        'build/rep/2026-08-25T10-30-00-123Z-a1b2c3d4/report.csv',
      ),
    );
  });

  it('uses an absolute reportsDir as-is', () => {
    // `resolve` with a single argument yields a platform-absolute path, so this
    // covers Windows drive-rooted paths as well as POSIX ones.
    const absoluteBase = resolve('/absolute/reports');

    expect(resolveReportPath('/base', absoluteBase, report, 'json')).toBe(
      join(absoluteBase, '2026-08-25T10-30-00-123Z-a1b2c3d4', 'report.json'),
    );
  });

  it('keeps a custom base out of the default one entirely', () => {
    const path = resolveReportPath('/base', 'build/rep', report, 'md');

    expect(path).not.toContain('.thymian');
  });

  it('treats a blank reportsDir as unset instead of resolving to cwd', () => {
    // `''` would resolve to `cwd` itself and drop a timestamped run directory
    // straight into the user's project root.
    const fallback = resolveReportPath('/base', undefined, report, 'md');

    expect(resolveReportPath('/base', '', report, 'md')).toBe(fallback);
    expect(resolveReportPath('/base', '   ', report, 'md')).toBe(fallback);
  });
});

describe('run directory on disk', () => {
  it('lands all three formatters of one report in one run directory', async () => {
    const cwd = join(process.cwd(), 'tmp', 'shared-run-directory');
    await rm(cwd, { recursive: true, force: true });

    const report = reportFixture();
    const markdown = new MarkdownFormatter(new NoopLogger());
    markdown.init({ cwd });
    await markdown.report(report);
    await markdown.flush();

    const csv = new CsvFormatter(new NoopLogger());
    csv.init({ cwd });
    await csv.report(report);
    await csv.flush();

    const json = new JsonFormatter(new NoopLogger());
    json.init({ cwd });
    await json.report(report);
    await json.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const runDirectories = await readdir(reportsDir);
    const [runDirectory = ''] = runDirectories;

    // One directory for the whole run — not one per formatter.
    expect(runDirectories).toEqual(['2026-08-25T10-30-00-123Z-a1b2c3d4']);
    expect((await readdir(join(reportsDir, runDirectory))).sort()).toEqual([
      'report.csv',
      'report.json',
      'report.md',
    ]);
  });

  it('keeps one run together even when the report cannot name itself', async () => {
    const cwd = join(process.cwd(), 'tmp', 'unnamable-run-directory');
    await rm(cwd, { recursive: true, force: true });

    // Neither field sanitizes to anything usable, so the name comes entirely
    // from the wall clock and random hex — which each formatter used to draw
    // for itself, landing markdown, csv and json in three directories.
    const report = reportFixture({ reportId: '', createdAt: '' });

    const markdown = new MarkdownFormatter(new NoopLogger());
    markdown.init({ cwd });
    await markdown.report(report);
    await markdown.flush();

    const csv = new CsvFormatter(new NoopLogger());
    csv.init({ cwd });
    await csv.report(report);
    await csv.flush();

    const json = new JsonFormatter(new NoopLogger());
    json.init({ cwd });
    await json.report(report);
    await json.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const runDirectories = await readdir(reportsDir);
    const [runDirectory = ''] = runDirectories;

    expect(runDirectories).toHaveLength(1);
    expect((await readdir(join(reportsDir, runDirectory))).sort()).toEqual([
      'report.csv',
      'report.json',
      'report.md',
    ]);
  });

  it('does not write a run directory into cwd when reportsDir is blank', async () => {
    const cwd = join(process.cwd(), 'tmp', 'blank-reports-dir');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ cwd, reportsDir: '' });
    await formatter.report(reportFixture());
    await formatter.flush();

    // The default base, not a stamped directory sitting loose in `cwd`.
    expect(await readdir(cwd)).toEqual(['.thymian']);
    expect(await readdir(join(cwd, '.thymian', 'reports'))).toEqual([
      '2026-08-25T10-30-00-123Z-a1b2c3d4',
    ]);
  });
});
