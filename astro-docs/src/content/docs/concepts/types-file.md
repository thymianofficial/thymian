---
title: What is this types.d.ts file?
description: Explanation of the types.d.ts file and how it works
---

The `types.d.ts` file provides TypeScript type definitions for making HTTP requests within your hooks. It enables:

- **Type safety** for `utils.request()` calls
- **Autocomplete** in your IDE for endpoint URLs and request parameters
- **Compile-time validation** of request bodies and headers, query parameters, and path parameters

## How It Works

When you run `thymian sampler:init`, the sampler plugin analyzes your OpenAPI specification(s) and generates TypeScript types for every endpoint.

### Example

Given this OpenAPI endpoint:

```yaml
paths:
  /api/v1/launches:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                missionName:
                  type: string
                launchDate:
                  type: string
                  format: date-time
                rocketType:
                  type: string
```

The `types.d.ts` file generates:

```typescript
declare module '@thymian/hooks' {
  interface Endpoints {
    'POST http://localhost:3000/api/v1/launches': {
      req: {
        body: {
          missionName: string;
          launchDate: string;
          rocketType: string;
        };
        headers?: Record<string, string>;
        cookies?: Record<string, unknown>;
        query?: Record<string, unknown>;
        path?: Record<string, unknown>;
      };
      res: {
        statusCode: number;
        body: unknown;
        headers: Record<string, string | string[]>;
      };
    };
  }
}
```

### Type-Safe Requests in Hooks

With these types, your IDE provides autocomplete and error checking:

```typescript
import { BeforeEachRequestHook } from '@thymian/hooks';

const hook: BeforeEachRequestHook = async (request, context, utils) => {
  // TypeScript knows the structure of this request
  const response = await utils.request('POST http://localhost:3000/api/v1/launches', {
    body: {
      missionName: 'Apollo 11', // ✓ Type-checked
      launchDate: '2026-01-01T00:00:00Z', // ✓ Type-checked
      rocketType: 'Saturn V', // ✓ Type-checked
      // invalidField: 'test'  // ✗ Error: Property doesn't exist
    },
    headers: {
      'content-type': 'application/json',
    },
  });

  // Response is also typed
  console.log(response.statusCode); // ✓ Known to be a number
  console.log(response.body); // ✓ Known structure

  return request;
};

export default hook;
```

## Should You Edit It?

**No. Never edit `types.d.ts` manually.**

### Reasons

1. **Auto-generated**: The file is regenerated every time you run `thymian sampler:init`
2. **Derived from spec**: Types are calculated from your OpenAPI specification
3. **Overwritten**: Manual changes will be lost on the next regeneration

## When Is It Regenerated?

The `types.d.ts` file is regenerated when you run:

```bash
thymian sampler:init
```

Or:

```bash
thymian sampler:init --overwrite
```

## Working Without Types

If your project doesn't use TypeScript, you can ignore `types.d.ts`. Write hooks in JavaScript:

```javascript
// hook.beforeEach.js
const hook = async (request, context, utils) => {
  const response = await utils.request('POST http://localhost:3000/api/v1/launches', {
    body: {
      missionName: 'Apollo 11',
      launchDate: '2026-01-01T00:00:00Z',
      rocketType: 'Saturn V',
    },
    headers: {
      'content-type': 'application/json',
    },
  });

  return request;
};

export default hook;
```

The file is still generated but has no effect on JavaScript files.

## File Location

```
.thymian/samples/
├── types.d.ts           ← Generated TypeScript types
├── tsconfig.json        ← TypeScript configuration for hooks
└── Your_API/
    └── ...              ← Your hooks and samples
```
