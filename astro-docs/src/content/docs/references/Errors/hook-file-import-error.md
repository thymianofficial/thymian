---
title: 'HookFileImportError'
---

## The Cause

A file under `.thymian/sampler/hooks/` could not be imported at all. Usually a
syntax error, or an import of a module that is not installed.

## What to do

The error names the file, relative to the hooks directory, and carries the
underlying failure as its cause — run with `--debug` to see it.

Unlike an unresolved hook, this is not something the sampler can report
alongside others: the scan could not finish, so it fails when the API
description is published rather than when a run starts.

Note the loader skips declaration files (`*.d.ts`) and dot-directories, so
neither of those can cause this. If you keep hand-written types beside your
hooks, a `.d.ts` name is the way to have them ignored.
