import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import type { Report } from '@thymian/core';

/**
 * Base directory — relative to the run's `cwd` — that per-run report
 * directories land in when the plugin's `reportsDir` option is not set.
 */
export const DEFAULT_REPORT_DIRECTORY = '.thymian/reports';

/**
 * Stem every derived report file is named after. The run is identified by the
 * directory around it, so the file itself keeps a stable, predictable name and a
 * reader can open `report.md` in any run directory without looking it up.
 */
export const REPORT_BASENAME = 'report';

/** Number of `reportId` characters kept in a derived directory name. */
const SHORT_ID_LENGTH = 8;

/**
 * Upper bound on the `<stamp>` part of a derived directory name. A well-formed
 * ISO timestamp is 24 characters, so this only bites for a pathological
 * `createdAt` — and it keeps the whole name far inside the 255-byte `NAME_MAX`
 * that every filesystem we target enforces.
 */
const MAX_STAMP_LENGTH = 32;

/**
 * Reduce a value to characters that are legal in a path segment on every
 * platform we support: every character outside `[A-Za-z0-9-]` is *replaced* by
 * `-`, runs of `-` are then collapsed into one and leading/trailing `-` trimmed.
 * Notably `:` — the Windows CI leg cannot create a directory containing one —
 * and the `.` inside an ISO timestamp become `-`, so a derived directory name
 * carries no dots and no separators at all. A non-string (a malformed report),
 * or a value made up entirely of unsafe characters, yields `''` — which callers
 * treat as "no usable part" and replace with a fallback.
 */
function sanitize(value: string | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replaceAll(/[^A-Za-z0-9-]/g, '-')
    .replaceAll(/-{2,}/g, '-')
    .replaceAll(/^-|-$/g, '');
}

/**
 * Cap a stamp at {@link MAX_STAMP_LENGTH}, never leaving a trailing `-` behind.
 * A well-formed ISO stamp is shorter than the cap and passes through untouched.
 */
function clampStamp(stamp: string): string {
  return stamp.length <= MAX_STAMP_LENGTH
    ? stamp
    : stamp.slice(0, MAX_STAMP_LENGTH).replaceAll(/-+$/g, '');
}

/** Fallback short id for a report whose `reportId` carries nothing usable. */
function randomShortId(): string {
  return randomBytes(SHORT_ID_LENGTH / 2).toString('hex');
}

/**
 * Names already derived for a given {@link Report} instance, so a report whose
 * own fields cannot name it still gets ONE directory rather than one per
 * formatter. Weakly held: an entry lives exactly as long as the report object
 * the caller is still passing around.
 */
const runDirectoryNames = new WeakMap<Report, string>();

/** The naming rule itself, applied once per report by the memoizing wrapper. */
function deriveRunDirectoryName(report: Report | undefined): string {
  const stamp = clampStamp(
    sanitize(report?.createdAt) || sanitize(new Date().toISOString()),
  );
  const shortId =
    sanitize(report?.reportId).replaceAll('-', '').slice(0, SHORT_ID_LENGTH) ||
    randomShortId();

  return `${stamp}-${shortId}`;
}

/**
 * Derive the name of the directory that holds one run's reports:
 * `<stamp>-<shortId>`, e.g. `2026-08-25T10-30-00-123Z-a1b2c3d4`.
 *
 * `<stamp>` is the report's `createdAt` run through {@link sanitize} and capped
 * at {@link MAX_STAMP_LENGTH}; `<shortId>` is the first {@link SHORT_ID_LENGTH}
 * characters of its `reportId` with dashes stripped. Both parts come from the
 * same {@link Report}, so every formatter in a run derives the identical
 * directory and that run's files sit side by side inside it.
 *
 * Not a pure function of the report's *fields*, but **stable per report
 * object**: where a field carries nothing usable the stamp falls back to the
 * wall clock and the id to random hex, and both fallbacks are non-deterministic,
 * so the derived name is memoized against the report instance in a
 * module-level {@link WeakMap}. Every formatter handed the same report object
 * therefore resolves the same directory even on the fallback path — two
 * distinct objects with the same unusable fields still get two directories.
 *
 * Total: a malformed or missing report never throws and never yields an unsafe
 * or unbounded name.
 */
export function defaultRunDirectoryName(report: Report | undefined): string {
  // Only an object can key a WeakMap; a missing (or malformed non-object)
  // report simply derives a fresh name and is never memoized.
  const key: unknown = report;
  if (typeof key !== 'object' || key === null) {
    return deriveRunDirectoryName(report);
  }

  const memoized = runDirectoryNames.get(key as Report);
  if (memoized !== undefined) {
    return memoized;
  }

  const name = deriveRunDirectoryName(report);
  runDirectoryNames.set(key as Report, name);

  return name;
}

/**
 * Resolve the base directory every run directory is created under: a relative
 * `reportsDir` is anchored to `cwd`, an absolute one is used as-is, and an
 * unset (or blank) one falls back to {@link DEFAULT_REPORT_DIRECTORY}.
 *
 * A blank `reportsDir` counts as unset: `''` resolves to `cwd` itself, which
 * would scatter run directories through the user's working directory. The
 * options schema rejects it up front (`minLength: 1`); this is the second
 * layer, for callers that construct a formatter directly.
 *
 * Shared by {@link resolveReportPath} and the reporter plugin's registration
 * time precondition check, so the directory that is verified writable is
 * exactly the directory that is later written to.
 */
export function resolveReportsBaseDirectory(
  cwd: string,
  reportsDir: string | undefined,
): string {
  const base =
    reportsDir !== undefined && reportsDir.trim() !== ''
      ? reportsDir
      : DEFAULT_REPORT_DIRECTORY;

  return resolve(cwd, base);
}

/**
 * Single source of truth for where a file formatter writes.
 *
 * Every report lands as `report.<ext>` inside its own directory, named after
 * that report (see {@link defaultRunDirectoryName}), beneath `reportsDir` — a
 * relative base is anchored to `cwd`, an absolute one is used as-is, and an
 * unset one falls back to {@link DEFAULT_REPORT_DIRECTORY}. So
 * `.thymian/reports/2026-08-25T10-30-00-123Z-a1b2c3d4/report.md`.
 *
 * The layout is uniform and unconditional: because the directory comes from the
 * report itself, two reports never share one, and every formatter that sees the
 * same report resolves the same directory — one run's formats land side by
 * side.
 */
export function resolveReportPath(
  cwd: string,
  reportsDir: string | undefined,
  report: Report | undefined,
  extension: string,
): string {
  return resolve(
    resolveReportsBaseDirectory(cwd, reportsDir),
    defaultRunDirectoryName(report),
    `${REPORT_BASENAME}.${extension}`,
  );
}
