---
name: thymian-initialize-samples
description: Use when generated Thymian sampler requests must be created or regenerated and early checks show placeholders, missing prerequisites, auth drift, repeated 404s, or unstable full-suite results.
---

# Initialize Samples

## Overview

The goal is not just to generate `.thymian/samples/`. The goal is to get a trustworthy failing baseline, fix only the sample issues, and stop when the remaining failures are real backend or spec mismatches.

## When To Use

- `.thymian/samples/` does not exist yet.
- `sampler init --overwrite` is needed after a spec change.
- `sampler check` shows many `404`, `401`, `403`, `400`, or placeholder-driven failures.
- Generated files contain `0`, `string`, empty identifiers, bad enums, or read-model bodies.
- Full runs are noisy because of auth collapse, rate limits, or timeouts.

Do not use this skill for a single near-correct `request.json`. Use `update-sample-file` instead.

## Workflow

### 1. Start from the project's real entry point

- Prefer the repo's existing `thymian.config.*` and project wrapper command over generic examples.
- If the repo already uses a custom Thymian binary or wrapper, use that exact command.
- Only fall back to raw `thymian sampler init/check` flags when no project command exists.

### 2. Generate or regenerate samples

- Use `sampler init --config <config>` when a config already exists.
- Use `sampler init --spec <type:path>` only when there is no project config.

### 3. Prove the target is reachable before triaging samples

- Run `sampler check` once to verify the server is up and the auth flow is at least being exercised.
- If the server is down, stop and tell the user.
- If the run collapses immediately with widespread `401`, `403`, or dispatch errors, do not treat it as a baseline yet.

### 4. Establish a trustworthy baseline

- Save every full run to a log file.
- Promote a run to “baseline” only if it is internally consistent.
- Do not trust counts from runs with obvious auth collapse, mass `401`, or mid-run transport failure.
- If the project supports a pinned bearer token or similar stable auth input, use it for repeatability.

### 5. Triage by failure shape before editing

Common buckets:

| Pattern                                                          | Usually means                                  | Typical fix                                         |
| ---------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| expected `200/201/204`, got `404`                                | missing prerequisite resource or bad static id | `beforeEach` hook or static id/query fix            |
| expected `403`, got `200`                                        | wrong identity                                 | authorize hook                                      |
| expected `403`, got `404`                                        | resource never existed                         | create prerequisite resource, then use limited user |
| expected `400/422`, got `404`                                    | placeholder blocked validation path            | keep resource valid, keep body invalid              |
| expected `200`, got `201`                                        | likely backend/spec mismatch                   | document unless setup depends on it                 |
| expected `200/412`, got `404` on auth/background/provider routes | feature unavailable in this server build       | document mismatch                                   |
| widespread `429`                                                 | helper-account churn or auth rate limiting     | switch to stable helper identities                  |
| late-run timeouts                                                | suite instability, not necessarily sample bugs | use targeted probes for the affected bucket         |

### 6. Choose the narrowest correct fix

Use this order:

1. `request.json` edit for static, durable, obvious mistakes.
2. Broad normalization hook only for mechanical fixes that are safe everywhere in scope.
3. Path-local `beforeEach` hook for endpoint-specific setup or dynamic ids.
4. Authorize hook only when the actor must change.

Related skills:

- `update-sample-file` for static bodies, headers, query, and path examples.
- `create-before-each-sampler-hook` for prerequisite resources and request shaping.
- `create-authorize-sampler-hook` for identity changes and permission tests.

### 7. Preserve the meaning of negative samples

- Do not blindly “fix” `400`, `403`, `404`, or `422` samples.
- Make them invalid in the right way.
- Prefer “missing but valid-looking id” over obviously invalid values when the sample should reach a `404` path.
- For permission tests, create the resource with one actor and exercise the request with another.

### 8. Use targeted probes when the full suite stops being informative

- Once you have a baseline, late-run timeouts should not block progress.
- Use direct API probes for one failing endpoint family to distinguish sample bugs from backend behavior.
- Keep the full suite for checkpoint runs, not for every small decision.

### 9. Stop at real backend or spec mismatches

Do not overfit hooks around real product behavior.

Stop and document when you confirm:

- backend returns `201` but spec expects `200`
- backend returns `500` for a valid direct request
- endpoint is unavailable in the running build
- expected permission status does not match real app semantics

## Guardrails

- Never hardcode expiring ids, tokens, or one-off resource values into `request.json`.
- Never put a broad hook high in the tree and then branch on many endpoint paths.
- Never let a sample delete or mutate data it did not create.
- Never assume one unstable full run is a trustworthy baseline.
- Never keep creating random helper accounts when a stable login-first account will work.

## Done Means

- Samples exist and are organized under `.thymian/samples/`.
- You have at least one trustworthy baseline log.
- Fixable sample issues have been addressed with the narrowest correct mechanism.
- Remaining failures are documented as backend/spec/build limitations instead of being hidden by hooks.
