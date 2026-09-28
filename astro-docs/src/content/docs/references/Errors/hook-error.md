---
title: 'HookError'
---

## The Cause

A hook threw an exception that is not
[`utils.skip`](/guides/hooks/skip-and-fail-tests/) or `utils.fail` — so it is a
defect in the hook rather than a verdict about the test case.

## What to do

The message names the hook's kind, its export and its file:

```
The beforeEach hook exported as "seedLaunch" from "seed.ts" threw.
```

The Transaction it was running for is not repeated here — every surface that
reports a hook failure already prints that Transaction's Selector above the
message. In `thymian sampler check` the transaction is marked `errored` and the
run continues; one broken hook does not end the command.

Run with `--debug` to see the original error and its stack.

If what you meant was "this test case cannot run", use `utils.skip(message)`; if
you meant "this test case has failed", use `utils.fail(message)`. Both are
control flow and neither is reported as an error in the hook.
