---
title: 'RequestCycleError'
---

## The Cause

A [`utils.request`](/guides/hooks/make-requests-in-hooks/) call would re-enter a
Transaction whose pipeline is already running — a hook seeding itself, or two
hooks seeding each other.

By default a nested request runs the target's own hooks, so a cycle would recurse
until the stack gave out. A stack overflow names nothing, so the sampler refuses
first.

## What to do

The error prints the chain, which is where the fix lives:

```
A cross-endpoint request would re-enter "GET /launches/{id} -> 200 (application/json)", which is already running.
Try this:
  * The chain is:
      "GET /launches/{id} -> 200 (application/json)"
      → "POST /launches (application/json) -> 201 (application/json)"
      → "GET /launches/{id} -> 200 (application/json)"
  * Break the cycle, or pass `{ runHooks: false }` to seed from the raw request
    without running the target's hooks.
```

`A → B → A` is usually a mistake three files apart, and the middle of the chain
is the hook to change.

Two ways out:

- **Break the cycle.** Often one of the two hooks does not need the other.
- **Seed raw.** `utils.request(selector, args, { runHooks: false })` sends the
  generated request without running the target's hooks, which cannot recurse.

Nothing is sent before the refusal.
