---
name: thymian-test
description: >-
  Diagnose and resolve `thymian test` HTTP conformance findings (errors,
  warnings, hints, info) for any API. USE WHEN running `thymian test`, when it
  reports "Summary: X error(s), Y warning(s), Z hint(s), W info finding(s)",
  when a conformance rule fires (e.g.
  `response-headers-must-conform-to-schema`, `response-body-must-conform-to-schema`,
  or `rfc9110/*` rules for `WWW-Authenticate`, `Location`, `ETag`, `Last-Modified`,
  or conditional requests), or when the user mentions thymian test, conformance
  rules, rule sets (rfc-9110, api-description-validation), ruleSeverity, or
  driving errors/warnings to zero. Covers the three resolution paths (fix the
  API, document the spec, downgrade the rule) and the spec-change/sampler-rehash
  coupling. Do NOT use for `thymian sampler check` status-code failures
  ("Expected status X, received Y" — use the thymian-sampler-check skill) or
  `thymian lint` static-only spec analysis.
version: 1.0.0
author: qupaya
---

# Thymian Test

**Domain**: live HTTP conformance / API-governance rule checking
**Tool**: [Thymian](https://thymian.dev) — `npx thymian test`
**Use when**: triaging or resolving `thymian test` errors/warnings against a running API
**Sibling skill**: for status-code/content-type contract failures use **thymian-sampler-check** instead.

## What `thymian test` actually checks (and how it differs)

`thymian test` dispatches requests against the **live API** and evaluates the responses against the **loaded rule sets** — typically `@thymian/rules-rfc-9110` (HTTP RFC semantics) and `@thymian/rules-api-description-validation` (does the live response match what the spec documents). It is the runtime counterpart to `thymian lint` (static, spec-only, no HTTP).

This is a different question from `thymian sampler check`:

| Command                 | Asserts                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `thymian sampler check` | response **status + content-type** match the documented response                       |
| `thymian test`          | response satisfies the loaded **rules** (RFC semantics + spec/body/header conformance) |
| `thymian lint`          | the **spec itself** is conformant (static, no requests sent)                           |

A `test` finding is a **rule violation**, not a status mismatch. So the fix is never "edit a sample" — it is one of the three resolution paths below.

## The result model: severities

The text report ends with `Summary: X error(s), Y warning(s), Z hint(s), W info finding(s) across N run(s).` Each finding has a **severity**:

- `error` — a contract/RFC defect that should block. The usual goal is **0 errors**.
- `warn` — surfaced but non-blocking. Triage these; many are SHOULD-level niceties or framework behavior.
- `hint` — lowest rule severity; a suggestion worth a look, never blocking.
- `info` — informational findings (e.g. emitted by tools/hooks). Not assignable to a rule.
- `off` — config-only: suppresses a rule entirely.

Rule severity is set in the config (`thymian.config*.yaml`); the configurable values are `error | warn | hint | off` (`info` is a finding severity only):

```yaml
ruleSets:
  - '@thymian/rules-rfc-9110'
  - '@thymian/rules-api-description-validation'
ruleSeverity: warn # default for all rules in the loaded sets
rules:
  some/rule-id:
    severity: warn # per-rule override (error | warn | hint | off)
```

**Don't chase a green run by blindly silencing rules.** Downgrading is a legitimate resolution **only** for findings that are not real contract defects (see path 3). Always leave a comment explaining why.

## The three resolution paths

Read the rule id and the affected response, then pick **one**:

### Path 1 — Fix the API to conform (the genuine bugs)

Use when the finding reflects a real defect in what the API returns. These are the highest-value fixes and should not be silenced:

- **Response body doesn't match the documented schema** (`…response-body-must-conform-to-schema` / api-description-validation). Common causes and fixes:
  - A field can be null but the schema isn't `nullable` → mark it `nullable` (or stop returning null).
  - Wrong JSON type → the value is serialized as the wrong type (e.g. a DB driver returns a tinyint `0/1` instead of a boolean, or a numeric id is documented as a string). Coerce/retype at the boundary so the response matches the contract.
- **Missing RFC-mandated header on an error/redirect** that you agree the API should send (e.g. `WWW-Authenticate` on a real `401`, `Location` on a `201`). Emit the header in the handler/guard/interceptor.

⚠️ **Every header you ADD must also be documented in the spec** (path 2) — otherwise it just converts into a new `response-headers-must-conform-to-schema` finding.

### Path 2 — Document reality in the spec

Use when the API behavior is correct but the spec under-describes it:

- The app legitimately emits headers (security/cache/framework) that the spec doesn't list → add a `headers` map to the relevant `responses[*]` in the OpenAPI document. For many endpoints, a small **OpenAPI document transformer** at swagger-generation time (walking `paths[*][method].responses[*]`) is cleaner than editing each path by hand.
- The documented status set is wrong (e.g. a POST documents a `200` it never returns) → correct the spec so the contract matches reality.

After any spec change, regenerate and re-check (see the coupling note below).

### Path 3 — Downgrade or disable the rule (only for non-defects)

Use when the rule flags behavior that is **not** an API-contract defect and can't be reasonably fixed:

- Framework/infrastructure headers added outside the API contract (e.g. helmet's `cross-origin-resource-policy`, the web framework's `etag`, `cache-control`, `pragma`, `expires`) that would bloat the spec to document per-response.
- SHOULD-level RFC niceties the API deliberately doesn't implement in this environment (e.g. `Last-Modified` on aggregate/list endpoints with no single modification time; conditional-request `If-None-Match` → `304/412` handling you've decided not to build).

Set `severity: warn` or `hint` (keep it visible) or `off` (hide it), **with a comment** stating the rationale. Prefer `warn`/`hint` so the team keeps a visible backlog rather than silently dropping coverage.

> Rule-of-thumb mapping (rule id → likely path):
>
> - `…response-body-must-conform-to-schema` → **Path 1** (real DTO/type bug).
> - `…response-headers-must-conform-to-schema` → **Path 2** (document) for headers you intend to keep; **Path 3** (downgrade) for framework headers.
> - `rfc9110/…must-send-www-authenticate…`, `…location-header-for-201…` → **Path 1 + Path 2** (emit it, then document it).
> - `rfc9110/…should-send-etag`, `…should-send-last-modified`, `…304-or-412-when-if-none-match-fails` → **Path 1** if you want the feature, else **Path 3** (downgrade with rationale).

## The coupling that surprises people: spec changes re-hash the sampler

If the sampler plugin is configured, `thymian test` and `thymian sampler check` share the recorded transactions, and each sample carries a **spec hash**. **Editing the spec (or regenerating it) invalidates those hashes — both `test` and `check` then abort** with a "samples were generated at … regenerate" message. After any spec change you must:

1. `npx thymian sampler init --overwrite` (regenerates request bodies + hashes, keeps hooks).
2. **Re-apply any hand-edited request bodies** that `--overwrite` clobbered (restore from git).
3. **Delete orphan sample dirs** for responses no longer in the spec (otherwise `check` errors with "Unknown type").
4. If the API runs in a container that doesn't hot-reload, **restart it** so runtime changes (new headers, fixed bodies) actually take effect before re-checking.

Then re-run **both** `thymian test` and `thymian sampler check` — a header/body change must keep both green.

## Examples

**Example 1 — nullable body finding (Path 1)**
User says: _"`response-body-must-conform-to-schema` errors because `description` comes back null"_.
Actions: a real schema bug → mark `description` `nullable` in the response DTO/spec (or stop returning null). Note the spec edit invalidates the sampler hashes → `sampler init --overwrite` + restart the server before re-running.
Result: that error clears across every transaction that returned the field.

**Example 2 — framework-header noise (Path 3)**
User says: _"`response-headers-must-conform-to-schema` is firing for helmet's `cross-origin-resource-policy` on every endpoint"_.
Actions: not a contract defect → either document the header in the spec (Path 2, e.g. a document transformer) or set just that rule to `severity: warn` in the config `rules:` block with a comment explaining it's framework-added. Do not blanket-silence other rules to force a green run.
Result: the framework-header noise is triaged; genuine errors stay visible.

## Workflow checklist

1. `cd` into the config's directory; ensure the API is running on the configured host/port.
2. `npx thymian test -c <config>` → read the `Summary:` line (error/warning/hint/info counts). Focus on errors first.
3. Group findings by **rule id** (each rule usually fires across many transactions for the same root cause — fix the cause once).
4. For each rule, pick a resolution path: fix the API (1), document the spec (2), or downgrade the rule (3, non-defects only, with a comment).
5. If you changed the spec, run the regenerate/re-apply/delete-orphans/restart sequence above.
6. Re-run `thymian test` (and `thymian sampler check` if samples exist) until errors are 0 and the remaining warnings are intentional and documented.

## Gotchas

- **A `test` finding is never fixed by editing a sample.** Samples drive _which_ requests get sent; the finding is about whether the _response_ conforms. Fix the API, the spec, or the rule severity.
- **Adding a header without documenting it just moves the warning** from one rule (missing header) to another (header not in schema). Do Path 1 and Path 2 together.
- **Runtime changes need a server/container restart** to take effect — a finding that "won't go away" after a code change usually means the old build is still serving (common with Docker on macOS, where file-watch misses host edits).
- **A green run from mass-downgrading is a false win.** Errors going to 0 because every rule is `warn`/`off` hides real defects. Reserve downgrades for framework noise and SHOULD-level niceties, and comment the reason.
- **Type-coercion bugs are easy to miss**: a value that _looks_ right in the JSON (e.g. `1`) can still violate the schema (expected boolean `true`). Read the rule's expected-vs-actual detail, not just the field name.
- **`thymian lint` ≠ `thymian test`.** If the user only wants the spec validated statically (no running API), that's `lint`. `test` requires a live endpoint.

## Troubleshooting

**Error: "samples were generated at … regenerate" (test aborts)**
Cause: the spec changed, invalidating the sampler's per-transaction hashes. Solution: `npx thymian sampler init --overwrite`, re-apply hand-edited bodies, delete orphan sample dirs, then re-run.

**Symptom: every transaction errors with connection refused**
Cause: the API isn't running on the configured host/port. Solution: start the API first (`test` needs a live endpoint).

**Symptom: a finding persists after you fixed the code**
Cause: a stale server build is still serving the old responses (no hot-reload). Solution: rebuild/restart the API (or its container) and re-run.

**Symptom: warning count doesn't drop after emitting a header**
Cause: the header is now sent but undocumented, so it shifted into `response-headers-must-conform-to-schema`. Solution: document the header in the spec (Path 2), regenerate, restart, re-check.
