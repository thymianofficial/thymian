---
name: thymian-sampler-check
description: >-
  Diagnose and fix failing `thymian sampler check` transactions for any API.
  USE WHEN running `thymian sampler check`, when a sampled transaction reports
  "Expected status code X, but received Y" (e.g. expected 200/201 but got
  404/401/409/500), when adding or repairing request samples (`0-request.json`)
  or hooks (`*.beforeEach.ts` / `*.authorize.ts` / `*.afterEach.ts`) under
  `.thymian/samples/`, or when the user mentions sampler, sampler check, request
  samples, sample hooks, or status-code conformance. Covers the sampler mental
  model, the failure decision guide, the hook/`utils` API, and the `runHooks`
  trap. Do NOT use for `thymian test` rule/conformance findings (errors/warnings
  like header- or body-schema rules — use the thymian-test skill), `thymian lint`
  static analysis, or non-HTTP unit/integration tests.
version: 1.0.0
author: qupaya
---

# Thymian Sampler Check

**Domain**: HTTP status-code / content-type contract testing against a live API
**Tool**: [Thymian](https://thymian.dev) — `npx thymian sampler check`
**Use when**: running or fixing `thymian sampler check`; editing samples/hooks under `.thymian/samples/`
**Sibling skill**: for rule-based conformance findings (errors/warnings) use **thymian-test** instead.

## The one thing to get right

A failing sampler check is **NOT fixed by editing an expected status code**, because the expected status code is **not stored in the sample**. It is read from the API specification (the OpenAPI/`swagger.json` referenced by the config).

A sample directory contains only the **request** plus metadata:

- `requests/0-request.json` — the request that gets sent (`origin`, `path`, `method`, `headers`, `query`, `body`, `pathParameters`, `authorize`).
- `meta.json` — only `{ "sourceTransaction": "<hash>", "samplingStrategy": {...} }`. **No status code lives here. Never "fix" a status in `meta.json`.**
- optional hook files (`*.beforeEach.ts`, `*.authorize.ts`, `*.afterEach.ts`).

`thymian sampler check` sends each request against the **live API** and verifies the response **status + content-type** match what the **spec documents** for that transaction.

So a failure means one of:

1. The **request data** doesn't produce the documented response (wrong/missing body, params, or a path id that doesn't exist).
2. **Prerequisite state** is missing (the `{id}` resource was never created → 404; a referenced foreign key like `parentId` doesn't exist → 500).
3. **Auth** isn't set up the way the documented status needs it.
4. The **spec is genuinely wrong** (API really returns 201 where spec says 200) → fix the spec or the API, not the sample.

**Resolution is almost always: fix `0-request.json` and/or add a hook — not touch `meta.json`.**

## Where things live

Discover the layout instead of assuming — paths vary per project:

- **Config**: a `thymian.config*.yaml` (e.g. `thymian.config.yaml` or `thymian.config.test.yaml`). It points at the spec and the server host/port/basePath.
- **Samples root**: under `.thymian/samples/<Spec_Name>/<host>/<port>/<basePath>/...`.
- **Sample path encodes the transaction**: `<route>/@<METHOD>/[<reqContentType>]/<status>/[<resContentType>]/`.
  - Path params are folders in brackets: `event/[id]/@GET/200/application__json/`.
- **Hook type defs**: `.thymian/samples/types.d.ts`.

**Run from the directory that holds the config** — it is per-project, not necessarily at the repo root. Keep the `cd` in the same command, since it does not reliably persist between separate shell invocations:

```sh
cd path/to/api && npx thymian sampler check -c thymian.config.test.yaml
```

## Commands

| Command                                                    | Purpose                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `npx thymian sampler check -c <config>`                    | Run all sampled transactions against the live API                |
| `npx thymian sampler check -c <config> --incremental`      | Process sequentially; offers hook generation on failures         |
| `npx thymian sampler init --spec openapi:<spec>`           | Generate initial samples from the spec                           |
| `npx thymian sampler init --overwrite`                     | Re-generate request samples after the spec changed (keeps hooks) |
| `npx thymian sampler generate hook --for-transaction <id>` | Scaffold a hook for one transaction                              |

**Prerequisite**: the **API must be running** on the configured host/port. If everything fails with connection errors, start the API first.

## How to resolve failures (decision guide)

Read the reason line: `Expected status code X, but received Y`. Then classify:

### Got 404 where 2xx expected — on a `{id}` / reference route

The resource id in the sample doesn't exist. Add a `*.beforeEach.ts` next to the sample that **creates** the resource and injects the real id into `request.pathParameters`. Guard it so the `404`-expecting sample keeps its non-existent id:

```ts
import { BeforeEachRequestHook } from '@thymian/hooks';

const hook: BeforeEachRequestHook = async (request, context, utils) => {
  // For the 404 sample we WANT a missing id — leave it alone.
  if (context.thymianRes.statusCode === 404) return request;

  const response = await utils.request(
    'POST http://localhost:3000/resource',
    {
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: { name: utils.randomString() },
    },
    { runHooks: false },
  ); // see "the runHooks trap" below

  if (response.statusCode === 201) {
    request.pathParameters['id'] = response.body.id;
  } else {
    utils.fail('Expected 201 creating prerequisite but got: ' + response.statusCode);
  }
  return request;
};

export default hook;
```

### Got 500 where 2xx/201 expected — on a POST/PATCH with a body

The body references state that doesn't exist (a foreign key like `parentId: 0`) or has placeholder values (`"string"`, `0`). Fix the request body to valid data, or add a `*.beforeEach.ts` that creates the parent resource and injects its id into `request.body`. For values that must be unique per run, use `utils.randomString()`.

### Got 404/200 where 401 expected — auth transactions

The documented `401` needs the request sent **without/with invalid** credentials, and the route must actually exist.

- Got `404` → the route/prefix is wrong; confirm the live API actually exposes it.
- Got `200` → auth isn't being enforced, or the sample is unexpectedly authorized. Set `"authorize": false` in `0-request.json` and clear any api-key/token header.

For 2xx transactions that need real auth, add an `*.authorize.ts` that obtains a token and sets the header (only the **last** authorize hook in the cascade runs):

```ts
import { AuthorizeHook } from '@thymian/hooks';
const hook: AuthorizeHook = async (request, context, utils) => {
  request.headers['authorization'] = 'Bearer <token>'; // or fetch one via utils.request(..., { authorize: false })
  return request;
};
export default hook;
```

### Got 201 where 200 expected (or 409 where 400 expected) — contract mismatch

The API genuinely returns a different status than the spec documents. This is a **spec/API mismatch**, not a sample fix:

- API behavior is correct → update the spec (the documented response) so the contract matches reality.
- Spec is correct → it's an API bug; fix the handler's status code.
- For a `400` that returns `409` (or vice-versa): the request data isn't triggering the documented condition. A `400` needs an actually-invalid body; a `409` needs a real conflict (data already present). Adjust `0-request.json` / hook so the documented condition is actually produced.

After any spec change, run `npx thymian sampler init --overwrite` to regenerate samples, then re-check. (Note: `--overwrite` regenerates request bodies and **clobbers hand-edited bodies** — re-apply them from git afterward.)

## Request file format (`0-request.json`)

```json
{
  "origin": "http://localhost:3000",
  "path": "/api/resource/{id}",
  "method": "get",
  "authorize": false,
  "headers": { "content-type": "application/json", "accept": "application/json" },
  "cookies": {},
  "pathParameters": { "id": "abc123" },
  "query": {},
  "body": {}
}
```

- `pathParameters` values are substituted into `{...}` placeholders in `path` before sending.
- `authorize: true` runs the cascaded authorize hook; `false` skips it.
- Large/binary bodies: `"body": { "$file": "payload.json", "$encoding": "base64" }`.
- Multiple cases: add `1-request.json`, `2-request.json`, ... in the same `requests/` folder.

## Hook system essentials

- Place hook files anywhere in the samples tree; deeper = more specific. Hooks **cascade** parent→child.
- Filename pattern: `[prefix.]beforeEach.ts` / `[prefix.]authorize.ts` / `[prefix.]afterEach.ts`. Extensions: `.ts .js .mjs .cjs .mts .cts`.
- Must `export default` a function (sync or async).
- Execution order: all `beforeEach` (root→leaf) → **last** `authorize` only → request → `afterEach` (root→leaf).
- Signature: `(request, context, utils) => request` (beforeEach/authorize) — return the modified `request`.
- `context.thymianRes.statusCode` = the status this transaction **expects** (a `number`). Branch on it to skip setup for negative cases (e.g. the 404 sample).

### `utils` API

| Method                                       | Use                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `utils.request(urlOrMethodUrl, args, opts?)` | Make a type-safe call to set up state. Pass `{ runHooks: false }` / `{ authorize: false }` to avoid infinite loops. |
| `utils.randomString(len?)`                   | Unique values for names / external refs                                                                             |
| `utils.skip(reason)`                         | Skip this transaction                                                                                               |
| `utils.fail(msg)`                            | Fail immediately (the message becomes the transaction's Reason)                                                     |
| `utils.info/warn(...)`                       | Log to report (often **not** shown by the text reporter — see pitfalls)                                             |
| `utils.assertionSuccess/Failure(...)`        | Record assertions (a failure doesn't stop the test)                                                                 |

### The `runHooks` trap (the bug that wastes hours)

`utils.request` **runs sample hooks by default.** When a setup hook builds a chain of resources via `utils.request`, the target endpoint's **own** setup hook also fires and can hijack your data (e.g. a create hook randomizes a field so later lookups 404, or re-points a child to a different parent so downstream logic reads the wrong state).

- **Always pass `{ runHooks: false }` as the 3rd arg** for chain-building `utils.request` calls.
- Consequence: with `runHooks: false` the target's own randomization no longer runs, so **you must set unique values yourself** (e.g. a unique `name`/external ref) or the create returns `409`.
- To call a **parametrized** endpoint, use the template form with a `path` arg (a concrete URL that doesn't match a spec template is rejected): `utils.request('GET .../{id}/...', { path: { id }, query, headers }, { runHooks: false })`.
- Telltale: the created entity's id/ref in the response differs from what you sent, or a negative-case test (409/deadline) passes as 200.

## Examples

**Example 1 — 404 on an `{id}` route**
User says: _"sampler check says expected 200 but got 404 on `GET /users/{id}`"_.
Actions: locate the sample dir; the id in `0-request.json` doesn't exist → add a `create-user.beforeEach.ts` that `POST`s a user with `{ runHooks: false }`, injects `response.body.id` into `request.pathParameters['id']`, and returns early when `context.thymianRes.statusCode === 404`. Leave `meta.json` untouched.
Result: the 200 sample passes; the 404 sample still 404s.

**Example 2 — 201 where 200 expected**
User says: _"`POST /orders` is documented `200` but sampler check gets `201`"_.
Actions: this is a contract mismatch, not a sample fix → decide whether the API or the spec is right, correct the documented response (or the handler), run `sampler init --overwrite`, re-apply any hand-edited bodies, then re-check.
Result: the documented status matches reality and the transaction is green.

## Workflow checklist

1. `cd` into the config's directory; ensure the API is up on the configured host/port.
2. `npx thymian sampler check -c <config>`.
3. For each `✖`, read `Expected X but received Y` and locate the sample dir from the route/method/status.
4. Classify with the decision guide → fix `0-request.json` or add a `*.beforeEach.ts` / `*.authorize.ts`. **Do not edit `meta.json`.**
5. If it's a real contract mismatch (e.g. 200 vs 201), fix the spec or the API, then `sampler init --overwrite` and re-apply any hand-edited bodies.
6. Re-run check until clean and confirm stability across 2-3 runs. Commit samples + hooks (sampler suites are committed to git).

## Gotchas

- **Don't run from the wrong directory** — `Config not found`. Run from where the config lives, in the same command as the `cd`.
- **Don't paraphrase a fix as "edit the expected status in `meta.json`"** — there is no status there.
- **Placeholder values** (`"string"`, `0`, a sample ISO date) come from spec examples and frequently cause `400`/`500` — replace with valid data.
- **A `404`-expecting sample must keep a non-existent id** — guard setup hooks with `if (context.thymianRes.statusCode !== <success>) return request;`.
- **`--incremental` is the fastest way to triage** — it can scaffold a hook per failing transaction interactively.
- **`utils.info(...)` is often not shown** by the text reporter. To surface a value while debugging, branch and `utils.fail('DBG ...')` — the message appears as the transaction's Reason.
- **Some documented statuses can be genuinely unreachable** (e.g. validation that can never reject, or auth that always succeeds in a mock env). Those stay red as real findings — don't contort a hook to fake them; record the finding instead.

## Troubleshooting

**Error: `Config not found`**
Cause: running from a directory without the config. Solution: `cd` into the config's directory in the same command.

**Symptom: every transaction errors with connection refused**
Cause: the API isn't running on the configured host/port. Solution: start the API / its compose stack first.

**Error: "samples were generated at … regenerate" (check aborts)**
Cause: the spec changed, so the per-transaction spec hashes are stale. Solution: `npx thymian sampler init --overwrite`, then re-apply any hand-edited request bodies and delete sample dirs for responses no longer in the spec.

**Symptom: a previously-green negative test (401/409) now passes as 200, or a `{id}` test regressed to 404/500**
Cause: usually the `runHooks` trap — a chained `utils.request` is missing `{ runHooks: false }`. Solution: add it; use `utils.fail('DBG ...')` to print created ids/refs while diagnosing. If the API runs in a container that doesn't hot-reload, a stale server can also cause this — restart it.
