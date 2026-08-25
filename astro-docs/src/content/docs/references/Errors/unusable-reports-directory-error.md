---
title: 'UnusableReportsDirectoryError'
---

## The Cause

`@thymian/plugin-reporter` could not create the directory it writes reports into, and at least one
formatter is configured. The check runs while the plugin registers — before any workflow runs — so
the run stops immediately instead of computing findings that would never reach disk.

Common reasons:

- The directory sits on a read-only mount (`EROFS`) or the process lacks permission (`EACCES`).
- A regular file already occupies the path, or one of its parents (`ENOTDIR`).
- `reportsDir` points somewhere that does not exist and cannot be created.

This used to be a warning on stderr and an exit code of `0`: the run looked green, and a CI step
globbing the report files simply found nothing. It is a hard failure now.

## The Solution

Point the reporter at a directory it can create, or fix the one it has. `reportsDir` is a
plugin-level option — one base directory for every formatter:

```yaml
# thymian.config.yaml
plugins:
  '@thymian/plugin-reporter':
    options:
      # Optional. Defaults to .thymian/reports.
      reportsDir: build/reports
      formatters:
        markdown: {}
```

A relative `reportsDir` resolves against the run working directory (`--cwd`), an absolute one is
used as-is. Check that nothing else occupies the path:

```bash
ls -ld build/reports
```

If a run should not write report files at all, leave the formatters empty. Nothing is checked and
no directory is created:

```yaml
plugins:
  '@thymian/plugin-reporter':
    options:
      formatters: {}
```

Note that a failure _while_ a report is being written stays a logged warning rather than an error.
By then the findings already exist, and losing them would be worse than an incomplete file. Only
this up-front check fails the run.
