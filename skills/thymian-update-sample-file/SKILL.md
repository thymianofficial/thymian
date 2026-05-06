---
name: thymian-update-sample-file
description: Use when a generated Thymian request.json is almost correct but needs static fixes to placeholders, query values, enums, headers, or writable body fields before adding hooks.
---

# Update Sample File

## Overview

Edit `request.json` only when the problem is static and durable. If the value is dynamic, identity-dependent, or created by another request, stop and use a hook instead.

## When To Use

- Placeholder values are clearly wrong for a success case.
- A generated body contains read-only or response-only fields.
- Query defaults like `page=0` or `per_page=0` are wrong for that sample.
- An enum value is invalid but should be static.
- Headers or body shape are wrong in a way that will survive regeneration only if moved to a hook later.

Do not use this skill when the main problem is missing prerequisite resources or actor identity.

## Decision Framework

| Situation                                                        | Best fix                     |
| ---------------------------------------------------------------- | ---------------------------- |
| one sample has a wrong static literal                            | edit `request.json`          |
| many sibling samples share the same mechanical placeholder issue | broad normalization hook     |
| request needs a fresh resource id or parent chain                | path-local `beforeEach` hook |
| request shape is fine, actor is wrong                            | authorize hook               |
| sample is intentionally invalid for `400/403/404/422`            | leave it invalid             |

## Workflow

### 1. Find the exact sample file

Read the generated tree carefully. The path usually encodes:

1. API name
2. host and port
3. endpoint path segments
4. method
5. request media type
6. expected status
7. response media type

### 2. Compare sibling samples first

- Compare success and negative samples for the same endpoint.
- The same placeholder can be wrong in a `200` sample and correct in a `404` sample.
- If possible, compare the sample to real live behavior before editing.

### 3. Make success samples minimally valid

- Replace read-model bodies with the smallest writable body the endpoint accepts.
- Remove generated response-only fields.
- Replace placeholder enums with real enum values.
- Fix obviously bad query parameters when the sample should succeed.

Prefer the smallest valid body, not the most complete body.

### 4. Keep negative samples invalid in the right way

- For expected `404`, prefer a missing-but-valid-looking id over `0` if `0` produces `400`.
- For expected `400`, keep the parent resource valid and make the body or query invalid.
- For expected `403`, do not change the payload if the real issue is the actor.

### 5. Escalate to hooks at the right time

Stop editing the file and switch skills when:

- the value must be created at runtime
- the value is short-lived
- the endpoint needs a parent resource chain
- the request needs a different authenticated identity

## Good Static Edits

- `page: 0` -> `page: 1` for a success sample
- `per_page: 0` -> `per_page: 20` for a success sample
- trimming a generated create body down to writable fields only
- replacing `kind: 0` with a valid string enum

## Bad Static Edits

- hardcoding a real project id from your local database
- hardcoding a bearer token
- changing a `404` sample to use a real existing id
- replacing every `0` everywhere without checking the expected status

## Common Mistakes

- Editing a `request.json` when the real problem is missing setup
- Making a negative sample accidentally succeed
- Keeping a bloated response body for a write endpoint
