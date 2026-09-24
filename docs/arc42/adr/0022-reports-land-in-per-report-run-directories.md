# ADR-0022: File reports land in one run directory per report, under a plugin-level `reportsDir`

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-09-23 | —          | —             |

## Context

`@thymian/plugin-reporter` renders each `core.report` through its file formatters (`markdown`, `json`, `csv`). Until now, every formatter decided on its own where its output went:

- Each formatter had a per-formatter `path` option and fell back to a fixed default (`.thymian/reports/report.{md,csv,json}`). Every run that didn't set `path` overwrote the previous run's report.
- Nothing tied one run's files together. With separate `path` values, the formats of one run could land in unrelated places.
- Under `thymian serve`, one reporter instance serves every workflow in the session. The formatters collected all reports and wrote one aggregate at `flush`: a merged markdown rollup, a JSON array of every report, and one CSV stream. A fixed `path` also means the last write wins once a session emits more than one report.
- If the output location couldn't be created, each write logged an error and the run still exited `0`. A CI job globbing for reports matched nothing and went green.

CI pipelines and other tooling locate report files by their path. Once pipelines depend on a layout, changing it breaks them, so the layout needs to be settled once rather than left to each formatter. The project is at `0.2.x` canary, so a breaking change costs little now and more later.

Tracked in thymian-workspace#209; implemented in thymian PR #389.

## Decision

**1. One base directory, set at the plugin level.** We will configure report output with a single `reportsDir` option on `@thymian/plugin-reporter`, defaulting to `.thymian/reports`. A relative path resolves against `cwd`. Blank or `null` means unset. Formatters don't choose output locations.

**2. One directory per report, with fixed file names inside.** Every report is written to `<reportsDir>/<run directory>/report.<ext>`. The run directory name is `<createdAt>-<first 8 chars of reportId>`, with every character outside `[A-Za-z0-9-]` replaced by `-`:

```
.thymian/reports/2026-08-26T14-16-17-451Z-de3a3f0e/report.md
                                                  /report.csv
                                                  /report.json
```

- The name is derived from the report itself, so all formatters handling one report agree on the directory, and two reports never share one.
- Only `[A-Za-z0-9-]` is allowed. In particular there is no `:`, so the name is valid on Windows.
- The timestamp comes first and has a fixed width, so sorting the names as text also sorts them by time. `ls -1d <reportsDir>/*/ | tail -1` returns the latest run.

**3. Users can't set the output file name.** We will remove the per-formatter `path` option and replace it with nothing. This is a product decision, not a technical necessity: keeping `path` as an opt-in override would take one branch in the code. We are removing it because:

- One layout means one glob, `<reportsDir>/*/report.<ext>`, which works for every format, run, and command. Downstream steps never have to handle two layouts.
- Under `serve`, a fixed name silently overwrites itself once per workflow. That loses output exactly when a session produces several reports.
- Adding file-name control back later doesn't break anyone. Removing it later would.

A config that still sets `formatters.<name>.path` fails validation at registration and exits `2`. The option is rejected, not silently ignored.

**4. One set of files per report, no session aggregate.** Each `core.report` produces its own files. The aggregate that `serve` wrote at `flush` goes away. Combining reports is the job of `thymian report merge` ([ADR-0020](0020-report-inputs-are-cli-only-for-merge-and-diff.md)), not of the formatters.

**5. Output-directory failures: before a run they abort, during a write they only log.**

- **Before any workflow runs:** when at least one formatter is configured, the plugin creates `reportsDir` at registration and checks that it is writable. If either step fails, it raises `UnusableReportsDirectoryError` and the run exits `2`.
- **During a write:** failures are logged as errors and the run continues. By then the findings have been computed, and aborting would throw them away.

This difference is deliberate, and a code comment in `get-formatters.ts` guards it. Don't make the two cases consistent.

## Consequences

**Positive:**

- Runs no longer overwrite each other, and the report history is kept by default.
- A run's formats sit together in one directory.
- Consumers learn one glob, and it works for every format and command.
- `serve` sessions produce one set of files per workflow, so reports can be told apart.
- A misconfigured `reportsDir` stops the run before any work, instead of passing CI with no output.

**Negative:**

- **Breaking:** configs setting `formatters.<name>.path` stop validating and need migrating to `reportsDir`.
- **Breaking:** consumers of the `serve` session aggregate (the merged markdown rollup, the multi-report JSON array, the single CSV stream) lose it.
- A pipeline that needs exactly one file has to glob and pick one, either with `tail -1` or by starting from an empty `reportsDir`. With a cached or reused workspace, emptying the directory is a separate step.
- `.thymian/reports` grows without bound. There is no retention policy yet.
- Report paths are generated, so users can't see where a report went without extra effort. Today the path is logged at `info`, which the default `logLevel: warn` hides, so it only shows with `--verbose`.
- A run that fails before emitting any report still leaves an empty base directory behind. This only happens when formatters are configured.

**Neutral:**

- Formatters keep the `Formatter` contract. The only difference is that they now receive `cwd` and `reportsDir` from the plugin instead of reading a path from their own options.
- If file-name control comes back, the preferred form is a `fileName` template with `{createdAt}`/`{reportId}` placeholders, because names stay unique. A plain `path` override is the fallback. Either can be added without breaking anyone and would amend this ADR, not supersede it.

## Related

- [ADR-0016](0016-two-stage-report-actions.md): the report actions whose output this ADR places on disk
- [ADR-0020](0020-report-inputs-are-cli-only-for-merge-and-diff.md): `report merge`, which combines reports now that the formatters no longer aggregate
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): the CLI's exit codes; the `2` used here signals a setup failure, not an outcome based on findings
- Tracking issue: thymian-workspace#209; implementation and review: [thymian PR #389](https://github.com/thymianofficial/thymian/pull/389)

---

## Status History

| Date       | Status   | Notes                                                                               |
| ---------- | -------- | ----------------------------------------------------------------------------------- |
| 2026-09-23 | Accepted | Decided in a team meeting; recorded from the PR #389 review (thymian-workspace#209) |
