---
title: 'DefaultResponseTargetError'
---

## The Cause

A hook called `utils.request` with a [Selector](/references/plugins/sampler/hooks-api/#selectors)
whose status is `default` — the response your API description declares as its
OpenAPI `default`. Thymian does not test `default` responses: such a Transaction
names no status a request could be aimed at, so it cannot be a seed target.

The Transaction whose hook made the call ends `errored`; the run goes on.

## What to do

The error lists the statuses the operation documents. Aim the seed at one of
them instead:

```typescript
await utils.request('POST /launches (application/json) -> 201 (application/json)');
```

A hook that _targets_ a `default` Selector is refused the same way, as soon as
the hooks load, in an [UnresolvedHooksError](/references/errors/unresolved-hooks-error/).
