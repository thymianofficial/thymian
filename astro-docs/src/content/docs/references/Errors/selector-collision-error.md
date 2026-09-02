---
title: 'SelectorCollisionError'
---

## The Cause

Two Transactions in the loaded API description render the same
[Selector](/references/plugins/sampler/hooks-api/#selectors), so neither can be
addressed unambiguously.

A Selector is host-stripped and carries no query parameters or headers, so two
Transactions collide whenever they agree on method, path, status **and** media
types — whether they come from one description or two.

The most common cause is loading two descriptions of the same API, for example a
staging and a production document.

## What to do

The error names both sides, with each one's source and — where the description
carries the position — its file and line. Then:

- **If the two point at different documents**, load those sources separately.
  There is no way to say "the one from staging" in a Selector.
- **If they point at one document**, give the two operations distinct paths,
  methods, statuses or media types.

Nothing is dropped or resolved "last wins": which one a hook would have bound to
would depend on load order, which is not a thing anyone can reason about.
