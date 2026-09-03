---
title: Hooks API Reference
description: Complete reference for the sampler's hook authoring API — selectors, filters, hook kinds and the utils every hook is handed.
---

Everything a hook file can import from `@thymian/hooks`.

Samples are not files. The sampler projects a request for every Transaction in
your API description, in memory, on every run — so there is nothing on disk to
edit and nothing that can go stale. What you own is the hooks, and each one is
anchored to a **Selector**.

## Selectors

A Selector is the address of exactly one Transaction:

```
METHOD path [(requestMediaType)] -> status [(responseMediaType)]
```

```
GET /launches -> 200 (application/json)
POST /astronauts (application/json) -> 201 (application/json)
DELETE /astronauts/{id} -> 204
```

- **Host-stripped.** Changing the server URL in your description does not touch
  a Selector.
- **Media-qualified whenever a media type is declared** — not only when there is
  a body. A `content:` entry that names a media type but carries no schema still
  gets its own Selector and its own media part.
- **Fully qualified by construction.** Adding a status code or a media type to
  your description creates new Selectors; it never silently changes what an
  existing one points at.
- **Path templates, verbatim.** `{id}` is spelled the way the description spells
  it.

A component the grammar cannot carry bare is quoted — a path containing a space,
for example, renders as `GET "/a b" -> 200`. That is rare and mechanical; you
will normally see the plain form.

After [`thymian sampler init`](#thymian-sampler-init) the Selectors of your API
are a union type, so your editor completes them and a Selector that stops
existing becomes a compile error at the line of the hook that used it.

## Filters

To target a set of Transactions, pass a `TransactionFilter` instead of a
Selector.

```typescript
import { beforeEach } from '@thymian/hooks';

export const admin = beforeEach({ path: '/admin/**' }, (request, ctx, utils) => {
  utils.setHeader('x-admin', 'yes');
});
```

| Field               | Takes                                                     |
| ------------------- | --------------------------------------------------------- |
| `method`            | a `Method`, or a list                                     |
| `status`            | a `Status`, or a list                                     |
| `statusClass`       | `'1XX'` … `'5XX'`, or a list                              |
| `path`              | a `Path`, a [path glob](#path-globs), or a list of either |
| `requestMediaType`  | a `RequestMediaType`, or a list                           |
| `responseMediaType` | a `ResponseMediaType`, or a list                          |
| `not`               | filter fields to exclude, or a list of them               |

**Fields AND-combine; a list within a field OR-combines.** So

```typescript
{ method: ['GET', 'HEAD'], statusClass: '2XX' }
```

means "a GET or a HEAD that succeeds", and

```typescript
{ path: '/admin/**', not: { path: '/admin/*/audit-log' } }
```

means "everything under `/admin`, except an audit log". `not` is one level deep
by construction — an exclusion cannot itself carry a `not`.

Every field except `path` is a closed union taken from your description, so a
value that stops existing is a compile error. There are no regular expressions
(they cannot be typed) and no `tag` or `operationId` filters.

### Path globs

`path` also accepts a glob:

- `*` matches **exactly one** path segment. Never zero, never across a `/`.
  `/launches/*` matches `/launches/{id}` and does not match `/launches` or
  `/launches/{id}/crew`.
- A **trailing** `**` matches **one or more** segments. `/admin/**` is everything
  _under_ `/admin` — it does not match `/admin` itself. If you want both, write
  both.
- `**` is only legal as the final segment.
- Braces are literal. `{id}` matches the segment spelled `{id}`; write `*` to
  mean "any parameter segment".
- Matching is case-sensitive and anchored at both ends. The path a glob is
  matched against includes your description's server base path, so a server of
  `https://api.example.com/v1` makes the glob for its own `/admin/**` operations
  `/v1/admin/**`.

A glob that matches no path, and a filter whose values are all valid but
intersect no Transaction, **fail the run** with the paths that do exist. That
check happens when the description is loaded rather than in your editor: the
alternative was measured and cost 2.5 seconds per keystroke.

A value with no `*` in it is not a glob — it has to be an exact `Path`, which is
what keeps a typo'd path a compile error.

## Hook kinds

Every hook **returns nothing and mutates in place**. A hook file exports its
registrations; any export, named or default, is loaded.

```typescript
import { afterAll, afterEach, authorize, beforeAll, beforeEach, defineSample } from '@thymian/hooks';
```

### `defineSample(target, (draft, utils) => void)`

Shapes the generated request, at generation time. This is where a body, a
fixture file or the `authorize` flag belongs.

```typescript
export const shapeLaunch = defineSample('POST /launches (application/json) -> 201 (application/json)', (draft, utils) => {
  draft.body = utils.readJson('./fixtures/launch.json');
  draft.authorize = true;
});
```

At most **one per Transaction**. A second one for the same Transaction is a
conflict, reported when the hooks are loaded — not when that Transaction happens
to be reached.

### `beforeEach(target, (request, ctx, utils) => void)`

Runs before each request. Several `beforeEach` hooks on one Transaction compose
in registration order: file order on the outside, and source order within each
file.

```typescript
export const trace = beforeEach('GET /launches -> 200 (application/json)', (request) => {
  request.headers['x-trace-id'] = 'abc';
});
```

### `afterEach(target, (response, ctx, utils) => void)`

Runs after each response. Observe and assert here.

```typescript
export const checkShape = afterEach('GET /launches -> 200 (application/json)', (response, ctx, utils) => {
  if (response.statusCode === 200) {
    utils.assertionSuccess('listing responded 200', 'statusCode === 200');
  }
});
```

### `authorize(callback)` and `authorize(target, callback)`

Supplies credentials. `authorize(callback)` is the global hook;
`authorize(target, callback)` is targeted and **wins** for the Transactions it
covers. Exactly one hook runs for a Transaction — two sets of credentials on one
request is a conflict, not a composition.

```typescript
export const credentials = authorize((request, ctx, utils) => {
  request.headers['authorization'] = `Basic ${utils.readText('./token').trim()}`;
});
```

Whether it runs at all is decided by [authorization gating](#authorization).

### `beforeAll(callback)`

Runs **once**, before the first request of the run, in registration order. A
throw aborts the run. It may return a cleanup closure.

```typescript
export const seedDatabase = beforeAll(async (utils) => {
  await utils.request('POST /admin/reset -> 204', {}, { authorize: true });

  return async () => {
    await utils.request('POST /admin/teardown -> 204', {}, { authorize: true });
  };
});
```

There is no shared mutable state bag. A returned closure is how something set up
in `beforeAll` reaches teardown.

### `afterAll(callback)`

Runs when the run closes, together with the cleanups `beforeAll` returned — one
list, in **reverse** order of registration, best-effort.

- A teardown error is a warning; the rest of the teardown still runs.
- It runs even if a `beforeAll` threw.
- It runs **only if a request was sent**, so `thymian sampler show` and
  `thymian sampler init` never run somebody's teardown.

## Execution pipeline

```
core.request.sample:        generate the request  →  defineSample
http-testing.beforeRequest: [first request ever → beforeAll]  →  beforeEach …
http-testing.authorize:     if the run option and request.authorize agree → authorize
                            → the request is sent →
http-testing.afterResponse: afterEach …
core.close:                 [if a request was sent] afterAll + cleanups, reversed
```

### Authorization

The `authorize` hook supplies credentials; the request's own `authorize` flag
decides **whether** it runs. Both the run option and the flag must agree, and an
authorize hook has to be registered — so "force it on" needs both.

The flag defaults to what your description says: a Transaction whose operation
declares a security requirement starts `true`, and a Transaction whose declared
status is `401` is forced `false`, so a negative case stays negative.

It is an ordinary field of the request, so you can override it in either
direction:

```typescript
// statically
export const noAuth = defineSample('GET /health -> 200 (application/json)', (draft) => {
  draft.authorize = false;
});

// dynamically
export const authForThisOne = beforeEach('GET /me -> 200 (application/json)', (request, ctx, utils) => {
  utils.setAuthorize(true);
});
```

## `utils`

Every hook is handed a `utils` object.

### Typed setters

`setHeader`, `setQuery`, `setPathParam`, `setCookie`, `setBody`, `setAuthorize`.

These write into the same request that direct mutation does — a setter is a place
for the compiler to know a name and a value type, not a different mechanism. Use
whichever reads better:

```typescript
utils.setHeader('x-trace-id', 'abc');
request.headers['x-trace-id'] = 'abc';
```

In an `afterEach` hook the request has already been sent, so a setter there
changes nothing.

### File helpers

`readFile(path)`, `readText(path, encoding?)`, `readJson<T>(path)`.

A relative path resolves against **the hook file's own directory**, not the
working directory — a fixture lives beside the hook that uses it, and the hook
keeps working when the run starts somewhere else.

### `request(selector, args?, options?)`

Calls another Transaction, addressed by its Selector, to seed data across
endpoints.

```typescript
export const seedThenRead = beforeEach('GET /launches/{id} -> 200 (application/json)', async (request, ctx, utils) => {
  const created = await utils.request('POST /launches (application/json) -> 201 (application/json)', { body: { missionName: 'Artemis II' } }, { authorize: true });

  utils.setPathParam('id', created.body.id);
});
```

`args` **overlays** the generated request — `body`, `headers`, `query`, `path`,
`cookies` — so every group is a partial and you write only what you care about.
`utils.request(selector)` with no `args` at all sends the generated request. A
body is _replaced_ rather than merged, so pass the whole body when you pass one.

The response comes back as `{ statusCode, headers, body }`, with a JSON body
already parsed and typed by the Selector you asked for.

| Option      | Default           | Meaning                                                                                             |
| ----------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `runHooks`  | `true`            | Run the target's own `beforeEach` → `authorize` → `afterEach`, so seeding behaves like the real run |
| `authorize` | the target's flag | Force authorization on or off for this call                                                         |

There is no `forStatusCode`: the Selector already carries the status.

A nested request carries **its own** target's `authorize` flag, not the caller's.
Seeding a secured endpoint from an unsecured one needs `{ authorize: true }`.

#### Cycles

Re-entering a Transaction whose pipeline is already running fails loudly and
prints the chain:

```
A cross-endpoint request would re-enter "GET /launches/{id} -> 200 (application/json)", which is already running.
  The chain is:
    "GET /launches/{id} -> 200 (application/json)"
    → "POST /launches (application/json) -> 201 (application/json)"
    → "GET /launches/{id} -> 200 (application/json)"
```

`{ runHooks: false }` sends the generated request without running the target's
hooks, which is both the raw-seeding option and the way out of a cycle.

### Reporting

- `skip(message)` — end this test case as skipped.
- `fail(message)` — end this test case as failed.
- `info(message)`, `warn(message, details?)`
- `assertionSuccess(message, assertion?)`,
  `assertionFailure(message, details?)`
- `timeout(message, durationMs)`
- `randomString(length?)`

A hook with no test case to attach results to — `beforeAll`, `afterAll`,
`defineSample` — has them logged instead.

## Where hooks live

```
.thymian/sampler/
  generated/        committed, generated, do not edit
  hooks/            yours, any number of files, any nesting
  tsconfig.json     scaffolded once by init, yours from then on
```

The loader scans `hooks/` recursively. It keeps `.ts`, `.mts`, `.cts`, `.js`,
`.mjs` and `.cjs`, skips declaration files and dot-directories, and never calls
an exported function to find out whether it is a hook.

`@thymian/hooks` resolves at run time through the plugin itself, so **hooks run
whether or not you have run `init`** and whether or not anything is committed.

## Commands

### `thymian sampler init`

Optional, one-time. Creates the sampler root, generates the committed type
surface, scaffolds a `tsconfig.json`, and prints the one line you have to add to
your own `tsconfig.json`. It is what gives you Selector autocomplete and a type
gate; it is never required to run hooks.

The scaffolded `tsconfig.json` is **yours from the moment it is written**.
Neither `init` nor `sync` will touch it again.

### `thymian sampler sync`

Regenerates the committed types from your description. `--check` reports whether
regeneration _would_ change anything and writes nothing, exiting non-zero if it
would — that is the CI gate.

### `thymian sampler validate`

The authoritative gate. It regenerates the surface in memory, compares it with
what is committed, and type-checks your hooks against the fresh surface.

| committed vs fresh | hooks compile | outcome                                                                            |
| ------------------ | ------------- | ---------------------------------------------------------------------------------- |
| identical          | yes           | silent success                                                                     |
| **differs**        | **yes**       | **warning** — run `sampler sync`                                                   |
| differs            | no            | **error** — breaking drift: `sync`, then fix the hooks                             |
| identical          | no            | **error** — the hooks do not compile. Nothing drifted, so `sync` is not the remedy |

It also reports vacuous globs, zero-match filters and `defineSample` conflicts.
The comparison ignores comments and formatting, so a description-only edit and a
reordering of your document are not drift.

### `thymian sampler check`

Sends every Transaction's request against the live API and reports which ones
can be executed at all — a narrower question than `thymian test`, which checks
whether the responses conform. `--incremental` walks them one at a time,
printing the Selector to anchor a hook to when one fails.

It predates the virtual model and is unchanged by it, except that it no longer
needs anything generated first.

### `thymian sampler show <selector>`

Prints the request that would be sent for one Transaction, freshly generated.
Nothing is written.

```bash
thymian sampler show 'GET /launches -> 200 (application/json)'
```

An unknown Selector gets the nearest matches; a malformed one gets the grammar.
