---
title: Hook System Deep Dive
description: Understanding how the cascading hook system works internally and why it's designed this way.
---

Understanding how the cascading hook system works internally and why it's designed this way.
In most cases, you will not need this guide to work with Thymian. But if you're curious, keep reading!

## Overview

The hook system is the heart of the sampler plugin. It allows you to modify requests and responses through **TypeScript/JavaScript functions** that are **automatically discovered** based on their **filesystem location**.

This document explains the mechanics, execution model, and design rationale.

## Hook Discovery

### File System Scanning

When sampler initializes, it:

1. **Reads the directory structure** from `.thymian/samples/` (or any other configured directory)
2. **Scans each directory** for hook files
3. **Matches filenames** against regex patterns:
   - `/(.*\.)?beforeEach\.(ts|js|mjs|cjs|mts|cts)/`
   - `/(.*\.)?afterEach\.(ts|js|mjs|cjs|mts|cts)/`
   - `/(.*\.)?authorize\.(ts|js|mjs|cjs|mts|cts)/`

4. **Loads hooks dynamically** using `jiti` (Just-In-Time TypeScript/ESM loader)
5. **Builds a hook map** indexed by transaction ID

### Example Discovery

Given this structure:

```
Todos/
├── auth.authorize.ts
└── 127.0.0.1/
    └── 3000/
        └── users/
            ├── setup.beforeEach.ts
            └── @POST/
                └── validate.afterEach.ts
```

Sampler discovers:

- 1 authorize hook (applies to all)
- 1 beforeEach hook (applies to `/users/*`)
- 1 afterEach hook (applies to `POST /users`)

## Hook Cascading

### The Tree Structure

Hooks are associated with **tree nodes** that represent your API structure:

```
Root
└── Source (Todos)
    └── Host (127.0.0.1)
        └── Port (3000)
            └── Path (users)
                └── PathParameter ([id])
                    └── Method (@GET)
                        └── StatusCode (200)
                            └── ResponseMediaType (application__json)
                                └── Samples
```

Each node can have hooks attached.

### Traversal Algorithm

When preparing a request for transaction `T`:

1. **Start at root** of the samples tree
2. **Traverse down** to the specific samples node for `T`
3. **At each node**, collect hooks attached to that node
4. **Merge hooks** from parent into current (concatenation, not replacement)
5. **Result**: A list of hooks ordered from root to leaf

**Example Traversal:**

For `GET http://127.0.0.1:3000/users/123 -> 200`:

```
1. Root node → collect root hooks
2. Todos node → merge Todos hooks
3. 127.0.0.1 node → merge host hooks
4. 3000 node → merge port hooks
5. users node → merge path hooks
6. [id] node → merge parameter hooks
7. @GET node → merge method hooks
8. 200 node → merge status code hooks
9. application__json node → merge media type hooks
10. Samples node → final hook list
```

## Hook Execution Order

### BeforeEach Hooks

Execute **before the HTTP request is sent**, in order from root to leaf:

```typescript
1. Root beforeEach hooks
2. Source beforeEach hooks
3. Host beforeEach hooks
4. Port beforeEach hooks
5. Path beforeEach hooks (for each path segment)
6. PathParameter beforeEach hooks
7. Method beforeEach hooks
8. RequestMediaType beforeEach hooks
9. StatusCode beforeEach hooks
10. ResponseMediaType beforeEach hooks
```

Each hook receives the **modified request** from the previous hook:

```typescript
request0 (original)
  → hook1(request0) → request1
  → hook2(request1) → request2
  → hook3(request2) → request3 (final)
  → HTTP request sent
```

### Authorize Hooks

Execute **after beforeEach but before the request**, in the same cascading order.

Special behavior:

- Only the **last authorize hook** in the chain executes
- Earlier authorize hooks are ignored
- This allows child endpoints to override parent authorization

```t
// Only global-auth.authorize.ts runs for most endpoints
Todos/
├── global-auth.authorize.ts  ← Applies to all
└── public/
    └── local-auth.authorize.ts  ← Overrides for /public/*
```

### AfterEach Hooks

Execute **after the HTTP response is received**, in the same cascading order:

```typescript
HTTP response received
  → hook1(response0) → response1
  → hook2(response1) → response2
  → hook3(response2) → response3 (final)
  → test results recorded
```

## Hook Context

### What Hooks Receive

Each hook receives three arguments:

```typescript
async (value, context, utils) => {
  // value: The thing to modify (request or response)
  // context: Transaction information
  // utils: Utility functions
  return modifiedValue;
};
```

#### Value

**For beforeEach and authorize:**

```typescript
type HttpRequestTemplate = {
  origin: string;
  path: string;
  method: string;
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  pathParameters: Record<string, unknown>;
  cookies: Record<string, unknown>;
  body?: unknown;
  authorize: boolean;
  bodyEncoding?: string;
};
```

**For afterEach:**

```typescript
type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body?: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
};
```

#### Context

**For beforeEach and authorize:**

```typescript
type ThymianHttpTransaction = {
  transactionId: string;
  thymianReq: ThymianHttpRequest;
  thymianRes: ThymianHttpResponse;
  transaction: HttpTransaction;
};
```

**For afterEach:**

```typescript
type ContextForAfterEach = {
  requestTemplate: HttpRequestTemplate;
  request: HttpRequest; // Serialized request that was sent
};
```

#### Utils

See the Reference Section for the HookUtils API for more details.

## Hook Loading

### Dynamic Import

Hooks are loaded using `jiti` (Just-In-Time loader):

```typescript
const jiti = createJiti(import.meta.url);
const hook = await jiti.import<BeforeEachRequestHook>(hookPath);
```

This enables:

- **TypeScript support** without pre-compilation
- **ESM and CommonJS** compatibility
- **Hot reloading** during development

### Import Validation

After loading, sampler validates:

```typescript
if (module === null || typeof module !== 'function') {
  throw new Error('Hook must be exported as default function');
}
```

Hooks **must**:

- Be exported as `export default`
- Be functions (async or sync)
- Match the expected type signature

## Error Handling

### Hook Errors

If a hook throws an error:

```typescript
try {
  result = await hook(value, context, utils);
} catch (e) {
  if (e instanceof SkipError) {
    return { result: value, skip: e.message };
  }
  if (e instanceof FailError) {
    return { result: value, fail: e.message };
  }
  throw new ThymianBaseError(`Error in hook: ${e.message}`, { cause: e });
}
```

**Special Errors:**

- `SkipError` (from `utils.skip()`) → Skip test, continue with others
- `FailError` (from `utils.fail()`) → Fail test, continue with others
- Other errors → Stop execution, report error

### Hook Isolation

Hooks are **not isolated** from each other:

- Module-level variables persist across hook invocations
- Errors in one hook don't affect other endpoints
- Each transaction gets its own hook execution chain

## Limitations

### No Async Hook Discovery

Hooks are discovered synchronously at initialization. You cannot:

- Add hooks after initialization
- Conditionally load hooks based on runtime conditions

### No Hook Priorities

Hooks execute in filesystem order (alphabetically by filename within a directory). You cannot:

- Explicitly set hook execution order
- Guarantee one hook runs before another at the same level

**Workaround:** Use filename prefixes:

```
01-first.beforeEach.ts
02-second.beforeEach.ts
03-third.beforeEach.ts
```

### No Hook Deactivation

Once loaded, hooks always run. You cannot:

- Disable a hook without deleting/renaming it
- Toggle hooks on/off via configuration
