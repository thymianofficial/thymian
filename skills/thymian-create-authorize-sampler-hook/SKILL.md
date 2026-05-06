---
name: thymian-create-authorize-sampler-hook
description: Use when Thymian samples need authenticated identities, stable token bootstrap, or subtree-specific permission behavior where the actor, not the payload, determines the outcome.
---

# Create Authorize Sampler Hook

## Overview

Authorize hooks choose who sends the request. They should not hide missing setup. Use them when the request shape is already correct but the transaction needs the right identity.

## Core Pattern

- Start with one root authorize hook for the default actor.
- Add a deeper hook only when a whole subtree genuinely needs a different auth rule.
- Remember: the deepest matching authorize hook wins.

## When To Use

- most endpoints should run as one stable owner identity
- a subtree has real permission tests that need a limited user
- tokens must be generated dynamically or injected from the environment
- repeated runs need stable auth instead of repeated registration

Do not use this skill to create resources. That belongs in `beforeEach` hooks.

## Workflow

### 1. Pick the narrowest placement that matches the actor rule

- Put the default owner auth high in the tree.
- Put a deeper hook closer to the subtree only when the actor rule really changes there.
- Avoid one broad hook with many path-condition branches.

### 2. Bootstrap identities in a stable way

- Prefer an environment-provided token when available.
- Otherwise use login-first bootstrap for stable accounts.
- Register only as a fallback.
- Cache tokens with module-level promise caching.

### 3. If a subtree hook handles `403`, always define the non-`403` path too

A common failure is writing a subtree hook that only handles the limited-user case. That breaks all other requests in the subtree.

Use this pattern:

```ts
const hook: AuthorizeHook = async (request, context, utils) => {
  const isTopLevelForbiddenRequest = context?.thymianRes.statusCode === 403 && context.thymianReq.method === request.method && context.thymianReq.path === request.path;

  request.headers.Authorization = isTopLevelForbiddenRequest ? `Bearer ${await getLimitedToken(utils)}` : `Bearer ${await getOwnerToken(utils)}`;

  return request;
};
```

Why this matters:

- internal setup requests inside `beforeEach` can hit the same subtree hook
- those setup requests often still need the owner token
- switching purely on “expected status is 403” is too broad

### 4. Separate actor choice from request-specific setup

- Token bootstrap and identity selection belong here.
- Creating projects, tasks, labels, comments, or attachments does not.

### 5. Verify with direct permission probes if needed

- If a supposed limited user receives `200`, confirm that user really lacks permission.
- If a `403` sample still gets `404`, the resource probably does not exist yet.

## Quick Reference

| Problem                                                 | Fix                                               |
| ------------------------------------------------------- | ------------------------------------------------- |
| whole API should run as one owner                       | root authorize hook                               |
| subtree has permission samples needing another actor    | deeper subtree authorize hook                     |
| internal setup request accidentally became limited-user | top-level request check or explicit auth override |
| reruns create auth noise                                | stable login-first helper identities              |

## Guardrails

- Never use authorize hooks to paper over missing resources.
- Never assume subtree placement alone protects internal setup traffic.
- Never create a deep hook that only sets auth in one special branch.
- Never use `fetch`; use `utils.request(...)` for token bootstrap.

## Common Mistakes

- putting all auth logic in one giant root hook with many endpoint branches
- forgetting that the deepest hook wins
- using random helper-account registration on every run
- changing actor based only on expected `403` without checking whether the request is the top-level sampled request
