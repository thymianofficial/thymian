---
title: 'UnknownSelectorError'
---

## The Cause

A well-formed [Selector](/references/plugins/sampler/hooks-api/#selectors) that
names no Transaction in the loaded API description — usually because the
description moved, or because a component of the Selector is slightly off.

## What to do

The error lists the nearest matching Selectors: the same path under the same
method first, then the same path under another method. Compare them with what you
wrote — the difference is normally a status code or a media part.

```bash
npx thymian sampler show 'GET /launches -> 200 (application/json)'
```

`sampler show` is the quickest way to confirm a Selector's exact spelling, and it
prints the same suggestions when you get one wrong.

A Selector is never quietly re-bound to a nearby Transaction. That is the point
of anchoring a hook to a fully-qualified address.
