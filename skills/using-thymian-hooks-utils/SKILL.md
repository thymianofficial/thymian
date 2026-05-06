---
name: using-thymian-hooks-utils
description: Use when writing Thymian hooks that make internal API requests, cache helper state, manage authenticated setup traffic, or need hook-safe request shaping.
---

# Using Thymian Hook Utilities

## Overview

`utils.request(...)` is the default way to perform setup from hooks, but the important part is controlling side effects: stable identities, explicit status checks, and setup traffic that does not accidentally trigger the wrong auth behavior.

## Core Rules

### Prefer `utils.request(...)`

- Use `utils.request(...)` for setup calls.
- Pass path params via `path`, not by string-building the URL.
- Check every setup response explicitly.
- Fail fast with `utils.fail(...)`.

```ts
const project = await utils.request(
  'PUT http://localhost:3456/api/v1/projects',
  {
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: { title: 'Sample project' },
  },
  {
    runHooks: false,
    authorize: true,
  },
);

if (project.statusCode !== 201) {
  utils.fail(`Failed to create project. Expected 201, got ${project.statusCode}.`);
}
```

### Cache expensive bootstrap with a shared promise

- Module-level caching is good for helper identities and tokens.
- Cache the promise, not just the resolved value, so concurrent hook runs deduplicate correctly.
- Reset the promise on failure.

### Prefer stable helper accounts over random registration

- Try login first.
- Register only if the account does not exist.
- Log in again after registration.
- Resolve the numeric id from a stable endpoint like `GET /user`.
- Reuse that helper across endpoint families when the role is the same.

This avoids rate-limit noise and makes reruns reproducible.

### Internal setup traffic can still hit authorize hooks

- `authorize: true` on `utils.request(...)` will run the matching authorize hook.
- The deepest matching authorize hook still wins for internal setup requests.
- If a subtree authorize hook switches identities for `403` cases, internal setup calls in that subtree can accidentally inherit the limited user.

Use one of these protections:

1. Make the authorize hook distinguish the top-level sample request from internal setup requests.
2. Set the `Authorization` header explicitly on the internal request and disable auto-auth when needed.

### Keep setup idempotent

- Accept already-exists responses when that matches the product.
- Create fresh per-request resources when isolation is easier than reuse.
- Reuse long-lived identities, not long-lived mutable business data.

### Preserve intended invalidity

- Before normalizing a placeholder, check the expected status.
- Success samples should become minimally valid.
- Negative samples should remain invalid in the specific way that produces the expected error.

## When `utils.request(...)` is not enough

- Prefer staying inside the hook runtime.
- Use an external command only for capabilities the hook runtime cannot express cleanly, such as multipart file upload.
- If you must do that, use a stable token input such as an environment variable and keep the command deterministic.

## Quick Reference

| Problem                                    | Pattern                                            |
| ------------------------------------------ | -------------------------------------------------- |
| helper identity reused across many samples | module-level cached promise                        |
| path or child id depends on fresh resource | create in `beforeEach`, validate status, inject id |
| limited-user `403` should not affect setup | top-level request check or explicit auth override  |
| generated body is a read model             | replace with minimal writable fields               |
| nested resource setup                      | validate parent ids as well as child id            |

## Common Mistakes

- Using `fetch` instead of `utils.request(...)`
- Not checking status codes on setup calls
- Creating a new helper user every run
- Assuming internal setup requests bypass authorize hooks
- Reusing mutable resources when a fresh resource would isolate the sample better
- Turning a `404` sample into a `400` by keeping an obviously invalid id
