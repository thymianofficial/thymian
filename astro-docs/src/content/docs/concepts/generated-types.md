---
title: What are the files under generated/?
description: What the committed type surface is, why it is committed, and what it protects you from.
---

`thymian sampler init` writes two files and asks you to commit them:

```
.thymian/sampler/generated/
  request-types.d.ts   Endpoints, keyed by Selector, plus the spec-derived unions
  hooks-api.d.ts       the @thymian/hooks surface, typed against them
```

They are generated, they are committed, and they are not to be edited.

## What they give you

- **Autocomplete for Selectors.** `beforeEach('` and your editor offers every
  Transaction in your API, so you can discover them without reading the
  description.
- **Compile-time checking of everything a hook targets.** A Selector, a filter
  value, a path — all closed unions taken from your description.
- **Typed request and response bodies**, including the parsed body a
  `utils.request` call returns.
- **A drift oracle.** Every way an API change can invalidate a hook becomes a
  TypeScript error at that hook's own line.

## What is in `request-types.d.ts`

```typescript
export type Method = "DELETE" | "GET" | "POST" | "PUT";
export type Status = 200 | 201 | 204 | 400 | 401 | 404;
export type StatusClass = "2XX" | "4XX";
export type Path = "/astronauts" | "/astronauts/{id}" | "/launches";
export type RequestMediaType = "application/json";
export type ResponseMediaType = "application/json";

export type Endpoints = {
  "GET /astronauts -> 200 (application/json)": {
    method: "GET";
    path: "/astronauts";
    status: 200;
    requestMediaType: "";
    responseMediaType: "application/json";
    authorize: boolean;
    req: { … };
    res: { statusCode: 200; headers: { … }; body: … };
  };
  …
};

export type Selector = keyof Endpoints;
```

One key is exactly one Transaction, so a key carries its own status and media
types and there is no union of responses to narrow.

### Examples in your description become open literal unions

If your description gives examples for a property, they show up in the type:

```typescript
id: 'a1' | 'a2' | (string & {});
```

The literals autocomplete; the `& {}` keeps the type open, so any other string is
still allowed.

This is done **property by property**. An object example becomes examples on its
properties, one level down, recursively — never a union of whole example objects.
That is deliberate: hooks mutate the request in place, and on a union TypeScript
checks a property _write_ against the intersection of the members, so a union of
closed example objects would make ordinary mutation a compile error. `enum` and
`const` are already closed and are left alone.

## Why they are committed

Because they are the record of what your API description said, and that record is
what makes staleness detectable. There is no lock file: the types _are_ the lock
file.

`thymian sampler validate` regenerates the surface in memory and compares it with
what you committed — so it can tell "you have not run `sync`" apart from "your
hooks no longer fit the API". `thymian sampler sync --check` is the same
comparison as a CI gate.

The comparison ignores comments and formatting, so a description-only edit, a
document reordering and a reformat are not drift.

See [Upgrading Thymian](/guides/sampler/upgrading-thymian/) for the one ritual
this implies.

## Should I commit them?

**Yes.** Everyone on the project then shares the same baseline, the same
autocomplete and the same gate — and a pull request that changes the API shows
the type diff next to it.

## Regenerating

```bash
npx thymian sampler sync
```

`generated/` is rewritten wholesale, so a file left over from a shape your API no
longer has cannot survive. Nothing outside `generated/` is touched — in
particular not `tsconfig.json`, which `init` scaffolds once and is yours from
then on.

## Do I need them?

No. `@thymian/hooks` resolves through the plugin itself at run time, so
`thymian test` runs your hooks with nothing generated and nothing committed. What
`init` adds is editor support and a type gate — real value, and still optional.
