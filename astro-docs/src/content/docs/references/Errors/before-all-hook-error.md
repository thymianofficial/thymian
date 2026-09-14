---
title: 'BeforeAllHookError'
---

## The Cause

A [`beforeAll`](/references/plugins/sampler/hooks-api/#beforeallcallback) hook
threw. Setup that failed means the run is not in the state the hooks describe, so
the run is aborted rather than allowed to report failures against a fixture that
was never built.

## What to do

The message names the export and the file. Run with `--debug` to see the
original error.

Two things worth knowing:

- **Teardown still runs.** The latch is armed before the callbacks, so any
  cleanup closures already returned, and every `afterAll`, run on close — even
  though setup failed.
- **It runs once.** A second request cannot re-run setup that half succeeded.

If the failure is expected and recoverable — a service that is sometimes not
there — catch it inside the hook and use `utils.warn` instead of letting it
propagate.
