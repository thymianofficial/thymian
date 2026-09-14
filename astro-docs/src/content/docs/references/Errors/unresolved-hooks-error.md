---
title: 'UnresolvedHooksError'
---

## The Cause

One or more hooks target something the loaded API description does not have, so
the run refuses to start. Four things cause it:

- a [Selector](/references/plugins/sampler/hooks-api/#selectors) that names no
  Transaction
- a [filter](/references/plugins/sampler/hooks-api/#filters) value that is not a
  legal value for its field
- a path or [glob](/references/plugins/sampler/hooks-api/#path-globs) that
  matches no path
- a filter whose values are all legal but intersect no Transaction

## What to do

Every unresolved hook is reported, not just the first, and each one names its
file, its export and what it was pointing at:

```
2 sampler hooks do not resolve against the loaded API description.
Try this:
  * seed.ts (export "seedAstronaut"): beforeEach targets the selector
    "GET /astronauts/{id} -> 200 (application/json)", which names no transaction
    in the loaded API description
  * Did you mean one of these selectors?
  * "GET /astronauts/{astronautId} -> 200 (application/json)"
```

So the fix is mechanical: open each named file and correct each named target.

`npx thymian sampler validate` reports the same set without running anything, and
adds what `tsc` says about the hooks — which is usually the faster way to work
through them.

## Why it fails the run

A hook that silently stops matching is the failure mode the whole
selector-anchored design exists to remove. Running the suite as if nothing had
happened would report a green build for a suite that no longer does what its
author wrote.

The refusal happens **before the first request is sent**, so nothing has
happened yet.
