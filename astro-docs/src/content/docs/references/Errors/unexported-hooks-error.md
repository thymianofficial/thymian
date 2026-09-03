---
title: 'UnexportedHooksError'
---

## The Cause

A hook was created but never exported, so nothing can reach it.

Hook discovery is **export-based**: the sampler imports each file under
`.thymian/sampler/hooks/` and looks at what it exports. A hook is a value, and
a value nothing exports is a value nobody has.

```ts
import { beforeEach } from '@thymian/hooks';

// Creates a hook. Nothing can find it.
beforeEach('GET /launches -> 200 (application/json)', (request) => {
  request.headers['x-trace'] = 'yes';
});
```

This compiles, runs, and does nothing — which is why it is an error rather than
a warning. A hook that never fires looks exactly like a hook that had nothing
to do, so there is no run in which you would rather find out later.

## What to do

Assign it to an export. The name is yours; only the `export` matters.

```ts
import { beforeEach } from '@thymian/hooks';

export const addTrace = beforeEach('GET /launches -> 200 (application/json)', (request) => {
  request.headers['x-trace'] = 'yes';
});
```

A default export works, and so does an array — useful when one file builds
several hooks in a loop:

```ts
export default beforeEach(/* … */);

export const all = [beforeEach(/* … */), afterEach(/* … */)];
```

The error names the file that created each one:

```
2 sampler hooks are created but never exported, so nothing can reach them.
Try this:
  * forgot.ts: a beforeEach hook was created here but never exported,
    so nothing can reach it
  * Assign it to an export, as in: export const shape = beforeEach(...)
```

## What this does not report

A hook in a **shared module** that another file re-exports is reachable, and is
not reported — even though the file that merely imported the module also
created a copy of it along the way.

```ts
// hooks/shared.ts
export const shared = beforeEach(/* … */);

// hooks/re-export.ts
export { shared } from './shared.js';
```

Two hooks that agree on their kind, their target **and** their callback source
are treated as one hook, since nothing could tell them apart. So an unexported
hook that is a byte-for-byte duplicate of an exported one is not reported —
correctly, because that hook does fire.
