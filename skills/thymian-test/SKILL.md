---
name: thymian-test
description: >-
  Diagnose and resolve `thymian test` HTTP conformance findings (errors,
  warnings, hints, info) for any API. USE WHEN running `thymian test`, when it
  reports "Summary: X error(s), Y warning(s), Z hint(s), W info(s).",
  when a conformance rule fires (e.g.
  `thymian/response-headers-must-conform-to-schema`,
  `thymian/response-body-must-conforms-to-schema`, or `rfc9110/*` rules such as
  `rfc9110/origin-server-should-send-etag` and
  `rfc9110/origin-server-should-send-last-modified`), or when the user mentions thymian test, conformance
  rules, rule sets (rfc-9110, api-description-validation), ruleSeverity, or
  driving errors/warnings to zero. Covers the three resolution paths (fix the
  API, document the spec, downgrade the rule) and the spec-change/sampler-rehash
  coupling. Do NOT use for `thymian sampler check` status-code failures
  ("Expected status code X, but received Y" — use the thymian-sampler-check
  skill) or
  `thymian lint` static-only spec analysis.
version: 1.0.0
author: qupaya
---

# Thymian Test

**Domain**: live HTTP conformance / API-governance rule checking
**Tool**: [Thymian](https://thymian.dev) — `npx thymian test`
**Use when**: triaging or resolving `thymian test` errors/warnings against a running API
**Sibling skill**: for status-code/content-type contract failures use **thymian-sampler-check** instead.

## Non-negotiables

1. A `test` finding is a **rule violation** — never fix it by editing a sample or `meta.json`.
2. Pick each rule id's resolution path **deliberately**: fix the API, document the spec, or downgrade the rule (non-defects only, always with a comment). Some findings need the first two **together** (see 3).
3. A header you **add** to the API must also be **documented** in the spec — otherwise the finding just moves to another rule.
4. After **any** spec change: `npx thymian sampler init --overwrite`, re-apply hand-edited bodies, restart the server, then re-run **both** `thymian test` and `thymian sampler check`.
5. **Do not mass-downgrade rules to force a green run.**

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

The report ends with `Summary: X error(s), Y warning(s), Z hint(s), W info(s).` Each finding has a **severity**:

- `error` — a contract/RFC defect that should block. The usual goal is **0 errors**.
- `warn` — surfaced but non-blocking. Triage these; many are SHOULD-level niceties or framework behavior.
- `hint` — lowest rule severity; a suggestion worth a look, never blocking.
- `info` — informational findings (e.g. emitted by tools/hooks). Not assignable to a rule.
- `off` — config-only: suppresses a rule entirely.

Rules are configured in `thymian.config*.yaml` with two distinct knobs (`info` is a finding severity only — it cannot be assigned to a rule):

- `ruleSeverity` — a **minimum severity threshold** deciding which rules run at all: `error` (the default) runs only error-severity rules, `warn` adds warn rules, `hint` runs every active rule, `off` runs none.
- `rules:` — override an **individual** rule's severity (`error | warn | hint | off`), as a string shorthand or an object.

```yaml
ruleSets:
  - '@thymian/rules-rfc-9110'
  - '@thymian/rules-api-description-validation'
ruleSeverity: hint # minimum severity threshold: which rules run (default: error)
rules:
  some/rule-id: warn # shorthand — override this rule's severity
  other/rule-id:
    severity: off # object form (also takes options, skipOrigins)
```

**Don't chase a green run by blindly silencing rules.** Downgrading is a legitimate resolution **only** for findings that are not real contract defects (see path 3). Always leave a comment explaining why.

## The three resolution paths

Read the rule id and the affected response, then pick the fitting path — usually one, but an added header always needs Path 1 **and** Path 2:

### Path 1 — Fix the API to conform (the genuine bugs)

Use when the finding reflects a real defect in what the API returns. These are the highest-value fixes and should not be silenced:

- **Response body doesn't match the documented schema** (`thymian/response-body-must-conforms-to-schema` / api-description-validation). Common causes and fixes:
  - A field can be null but the schema isn't `nullable` → mark it `nullable` (or stop returning null).
  - Wrong JSON type → the value is serialized as the wrong type (e.g. a DB driver returns a tinyint `0/1` instead of a boolean, or a numeric id is documented as a string). Coerce/retype at the boundary so the response matches the contract.
- **Missing RFC-mandated header on an error/redirect** that you agree the API should send (e.g. `WWW-Authenticate` on a real `401`, `Location` on a `201`). Emit the header in the handler/guard/interceptor.

⚠️ **Every header you ADD must also be documented in the spec** (path 2) — otherwise it just converts into a new `thymian/response-headers-must-conform-to-schema` finding.

### Path 2 — Document reality in the spec

Use when the API behavior is correct but the spec under-describes it:

- The app legitimately emits headers (security/cache/framework) that the spec doesn't list → add a `headers` map to the relevant `responses[*]` in the OpenAPI document. For many endpoints, a small **OpenAPI document transformer** at swagger-generation time (walking `paths[*][method].responses[*]`) is cleaner than editing each path by hand.
- The documented status set is wrong (e.g. a POST documents a `200` it never returns) → correct the spec so the contract matches reality.

After any spec change, regenerate and re-check (see the coupling note below).

### Path 3 — Downgrade or disable the rule (only for non-defects)

Use when the rule flags behavior that is **not** an API-contract defect and can't be reasonably fixed:

- Framework/infrastructure headers added outside the API contract (e.g. helmet's `cross-origin-resource-policy`, the web framework's `etag`, `cache-control`, `pragma`, `expires`) that would bloat the spec to document per-response.
- SHOULD-level RFC niceties the API deliberately doesn't implement in this environment (e.g. `Last-Modified` on aggregate/list endpoints with no single modification time; conditional-request `If-None-Match` → `304/412` handling you've decided not to build).

Set `severity: warn` or `hint` (keep it visible) or `off` (hide it), **with a comment** stating the rationale. Prefer `warn`/`hint` so the team keeps a visible backlog rather than silently dropping coverage — but remember a downgraded rule only runs when `ruleSeverity` includes its severity.

> Rule-of-thumb mapping (rule id → likely path):
>
> - `thymian/response-body-must-conforms-to-schema` → **Path 1** (real DTO/type bug).
> - `thymian/response-headers-must-conform-to-schema` → **Path 2** (document) for headers you intend to keep; **Path 3** (downgrade) for framework headers.
> - Findings about RFC-mandated headers the API should emit (e.g. `WWW-Authenticate` on a real `401`) → **Path 1 + Path 2** (emit it, then document it).
> - `rfc9110/origin-server-should-send-etag`, `rfc9110/origin-server-should-send-last-modified`, and other SHOULD-level niceties → **Path 1** if you want the feature, else **Path 3** (downgrade with rationale).

## The coupling that surprises people: spec changes re-hash the sampler

If the sampler plugin is configured, `thymian test` and `thymian sampler check` share the recorded transactions, and the samples tree stores the **hash of the spec it was generated from** (the `version` in the samples-root `meta.json` — one hash for the whole tree). **Editing the spec (or regenerating it) changes the spec's hash — both `test` and `check` then abort** with a `VersionMismatchError` ("The loaded samples were generated at … Did you forget to regenerate the samples?"). After any spec change you must:

1. `npx thymian sampler init --overwrite` (regenerates request bodies + hashes, keeps hooks).
2. **Re-apply any hand-edited request bodies** that `--overwrite` clobbered (restore from git).
3. **Delete orphan sample dirs** for responses no longer in the spec (otherwise `check` errors with "Unknown type").
4. If the API runs in a container that doesn't hot-reload, **restart it** so runtime changes (new headers, fixed bodies) actually take effect before re-checking.

Then re-run **both** `thymian test` and `thymian sampler check` — a header/body change must keep both green.

## Examples

**Example 1 — nullable body finding (Path 1)**
User says: _"`thymian/response-body-must-conforms-to-schema` errors because `description` comes back null"_.
Actions: a real schema bug → mark `description` `nullable` in the response DTO/spec (or stop returning null). Note the spec edit invalidates the sampler hashes → `sampler init --overwrite` + restart the server before re-running.
Result: that error clears across every transaction that returned the field.

**Example 2 — framework-header noise (Path 3)**
User says: _"`thymian/response-headers-must-conform-to-schema` is firing for helmet's `cross-origin-resource-policy` on every endpoint"_.
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

- **Runtime changes need a server/container restart** to take effect — a finding that "won't go away" after a code change usually means the old build is still serving (common with Docker on macOS, where file-watch misses host edits).
- **Type-coercion bugs are easy to miss**: a value that _looks_ right in the JSON (e.g. `1`) can still violate the schema (expected boolean `true`). Read the rule's expected-vs-actual detail, not just the field name.
- **`thymian lint` ≠ `thymian test`.** If the user only wants the spec validated statically (no running API), that's `lint`. `test` requires a live endpoint.

## Troubleshooting

**Error: `VersionMismatchError` — "The loaded samples were generated at … Did you forget to regenerate the samples?" (test aborts)**
Cause: the spec changed, so its hash no longer matches the `version` stored in the samples-root `meta.json`. Solution: `npx thymian sampler init --overwrite`, re-apply hand-edited bodies, delete orphan sample dirs, then re-run.

**Symptom: every transaction errors with connection refused**
Cause: the API isn't running on the configured host/port. Solution: start the API first (`test` needs a live endpoint).

**Symptom: a finding persists after you fixed the code**
Cause: a stale server build is still serving the old responses (no hot-reload). Solution: rebuild/restart the API (or its container) and re-run.

**Symptom: warning count doesn't drop after emitting a header**
Cause: the header is now sent but undocumented, so it shifted into `thymian/response-headers-must-conform-to-schema`. Solution: document the header in the spec (Path 2), regenerate, restart, re-check.
