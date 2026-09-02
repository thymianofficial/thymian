---
title: 'HookConflictError'
---

## The Cause

Two hooks resolve fine but cannot both apply. Today that means two
[`defineSample`](/references/plugins/sampler/hooks-api/#definesampletarget-draft-utils--void)
hooks on the same Transaction.

`defineSample` shapes the generated request, and there is one generated request
per Transaction — so a second one is not a composition, it is a disagreement
about what the request should be.

## What to do

The error names both sides:

```
1 sampler hook conflicts with another hook on the same transaction.
Try this:
  * second.ts (export "two"): defineSample is already defined for the selector
    "GET /launches -> 200 (application/json)" by "one" in first.ts;
    a Transaction can have only one
  * Merge the two into one defineSample, or target a different selector.
```

Either merge them, or narrow one of the targets. If both were meant to run,
`beforeEach` is the kind that composes — several of those on one Transaction all
run, in registration order.

Note this is reported when the hooks are **loaded**, not when that Transaction
happens to be reached: the mistake exists whether or not the run gets there.
