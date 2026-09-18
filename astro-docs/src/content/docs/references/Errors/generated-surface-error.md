---
title: 'GeneratedSurfaceError'
---

## The Cause

`thymian sampler init`, `sampler sync` or `sampler validate` generated a type
surface (`request-types.d.ts` and `hooks-api.d.ts`) that does not compile on
its own, with `skipLibCheck: false`.

This is the self-check gate every fresh surface runs through before it is
written or used. It exists because everywhere else the surface is consumed —
the scaffolded tsconfig, the hook-authoring compile probe, `validate` itself —
sets `skipLibCheck: true`, since a user's own `@types` tree is not the
sampler's business to police. That is exactly the flag that stops TypeScript
from reporting an error _inside_ a `.d.ts`, so without this gate a defect in
generation could hide behind it and surface later as a confusing error in a
user's own hooks.

**This is never caused by your API description or your hooks.** The fault is
in the sampler's own generator.

## What to do

The error lists every `tsc` diagnostic against the generated files, each
anchored to its file and line. Please
[open an issue](https://github.com/thymianofficial/thymian/issues) with the
message and, if you can share it, the API description that produced it — a
minimal one that reproduces the same diagnostics is even more useful than the
original.

There is no workaround from the API description or hooks side: nothing you
change there can fix a defect in generation itself.
