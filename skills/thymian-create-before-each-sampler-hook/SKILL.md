---
name: thymian-create-before-each-sampler-hook
description: Use when Thymian samples need per-endpoint setup, dynamic ids, parent-child prerequisite resources, or status-aware request shaping before the sampled request is sent.
---

# Create BeforeEach Sampler Hook

## Overview

`beforeEach` hooks make a request executable. They create the minimum prerequisite state, inject dynamic values, and shape the request so it reaches the intended success or failure path.

## When To Use

- a sample needs a real project, task, label, comment, bucket, or other resource id
- a nested endpoint needs a valid parent chain
- a success sample contains generated placeholders
- a negative sample needs valid parents but intentionally invalid child input
- a request body must be rewritten to a minimal writable shape at runtime

Do not use this skill when the only missing piece is the authenticated actor. Use `create-authorize-sampler-hook`.

## Workflow

### 1. Read the failing `request.json` first

- Check expected status and actual status.
- Inspect body, headers, path params, and query.
- Decide whether the sample should succeed or should stay invalid.

### 2. Place the hook at the lowest shared directory

- Prefer the narrowest path that matches the shared setup behavior.
- Use root-level hooks only for universally safe normalization.
- Avoid high-level hooks plus path `if` trees.

### 3. Make setup status-aware

Use the expected status to decide how much to fix.

| Expected status | What the hook should usually do                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `200/201/204`   | create all required prerequisite resources and inject valid ids                                    |
| `404`           | create valid parents, then point one identifier at a missing-but-valid target                      |
| `400/422`       | create valid parents, keep body/query invalid                                                      |
| `403`           | create the resource under the owner actor, then let the authorize hook switch to the limited actor |

### 4. Validate the whole parent chain

- For nested endpoints, validate parent params as well as the leaf id.
- Do not create the child only because the leaf placeholder is invalid while parent placeholders are still broken.

### 5. Prefer stable helper identities, fresh business resources

- Reuse stable helper users across runs.
- Create fresh projects/tasks/comments when per-request isolation is easier.
- Cache helper bootstrap with a shared promise.

### 6. Be careful with internal setup auth

- Internal setup requests can still hit authorize hooks.
- If a subtree authorize hook exists, make sure setup traffic still uses the correct actor.
- Do not accidentally create the resource as the limited user for a `403` sample.

### 7. Keep the hook minimal

- Only create the resources this endpoint family needs.
- Only rewrite the fields necessary for this sample to reach the intended path.
- Leave durable static fixes in `request.json` when possible.

## Example Pattern

```ts
const hook: BeforeEachRequestHook = async (request, context, utils) => {
  if (context.thymianRes.statusCode === 400) {
    return request;
  }

  const project = await utils.request(/* create project */);
  if (project.statusCode !== 201) {
    utils.fail(`Failed to create project. Expected 201, got ${project.statusCode}.`);
  }

  request.pathParameters.id = project.body.id;
  return request;
};
```

The early return is correct only when the sample is supposed to stay invalid. Do not return early in a way that blocks deeper, narrower setup that still needs to happen.

## Quick Reference

| Problem                                               | Fix                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| success sample has `id: 0`                            | create resource, inject real id                               |
| `404` sample gets `400` from invalid placeholder      | use missing-but-valid id instead                              |
| create/update body is generated from read model       | rewrite to minimal writable body                              |
| delete `403` sample gets `200`                        | create resource as owner, use authorize hook for limited user |
| many endpoints under one path share same parent setup | put hook at the shared path segment                           |

## Guardrails

- Never create resources for a negative sample without checking why it is supposed to fail.
- Never use `beforeEach` to choose the auth actor when an authorize hook is the right tool.
- Never assume setup requests are isolated from subtree authorize hooks.
- Never mutate or delete unrelated data.

## Common Mistakes

- fixing a `403` sample by creating the resource as the same actor that sends the request
- preserving obviously invalid `0` ids in a sample that should reach `404`
- creating only the leaf resource while parent ids are still placeholders
- using a random helper account per run instead of a stable one
