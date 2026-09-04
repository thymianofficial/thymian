---
title: 'HookError'
---

## The Cause

A hook threw an exception that is not
[`utils.skip`](/guides/hooks/skip-and-fail-tests/) or `utils.fail` — so it is a
defect in the hook rather than a verdict about the test case.

## What to do

The message names the hook's kind, its export and its file, plus the Transaction
it was running for:

```
The beforeEach hook exported as "seedLaunch" from "seed.ts" threw for
transaction GET /launches/{id} -> 200 (application/json).
```

Run with `--debug` to see the original error and its stack.

If what you meant was "this test case cannot run", use `utils.skip(message)`; if
you meant "this test case has failed", use `utils.fail(message)`. Both are
control flow and neither is reported as an error in the hook.
