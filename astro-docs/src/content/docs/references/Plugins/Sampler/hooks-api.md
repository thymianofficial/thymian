---
title: Hooks API Reference
description: Complete reference for the hooks utilities API provided to every hook function.
---

Complete reference for the hooks utilities API provided to every hook function.

## Hook Signatures

### BeforeEachRequestHook

Modifies requests before they are sent.

```typescript
import { BeforeEachRequestHook } from '@thymian/hooks';

const hook: BeforeEachRequestHook = async (request, context, utils) => {
  // Modify request
  return request;
};

export default hook;
```

**Parameters:**

- `request`: `HttpRequestTemplate` - The request to be sent
- `context`: `ThymianHttpTransaction` - Information about the current transaction
- `utils`: `HookUtils` - Utility functions

**Returns:** `HttpRequestTemplate` - The modified request

### AuthorizeHook

Adds authentication credentials to requests.

```typescript
import { AuthorizeHook } from '@thymian/hooks';

const hook: AuthorizeHook = async (request, context, utils) => {
  // Add authentication
  return request;
};

export default hook;
```

**Parameters:**

- `request`: `HttpRequestTemplate` - The request to be sent
- `context`: `ThymianHttpTransaction` - Information about the current transaction
- `utils`: `HookUtils` - Utility functions

**Returns:** `HttpRequestTemplate` - The modified request

### AfterEachResponseHook

Validates or processes responses after they are received.

```typescript
import { AfterEachResponseHook } from '@thymian/hooks';

const hook: AfterEachResponseHook = async (response, context, utils) => {
  // Validate response
  return response;
};

export default hook;
```

**Parameters:**

- `response`: `HttpResponse` - The received response
- `context`: `{ requestTemplate: HttpRequestTemplate; request: HttpRequest }` - Request context
- `utils`: `HookUtils` - Utility functions

**Returns:** `HttpResponse` - The response (possibly modified)

## Utils API

The `utils` object provides helper functions for common hook operations.

### `utils.request()`

Make type-safe HTTP requests to endpoints defined in your OpenAPI specification.

```typescript
async request<R extends keyof Endpoints>(
  url: R,
  args: Endpoints[R]['req'],
  options?: {
    runHooks?: boolean;      // Default: true
    authorize?: boolean;     // Default: undefined (follows runHooks)
    forStatusCode?: number;  // Default: undefined (use default response)
  }
): Promise<Endpoints[R]['res']>
```

#### Parameters

- **url** (`string`): Endpoint URL in format `METHOD http://host:port/path`
- **args** (`EndpointRequest`): Request data
  - `body`: Request body
  - `headers`: HTTP headers
  - `query`: Query parameters
  - `cookies`: Cookies
  - `path`: Path parameters
- **options** (optional): Request behavior options
  - `runHooks`: Execute hooks for this request (default: `true`)
  - `authorize`: Execute authorize hook for this request
  - `forStatusCode`: Use sample for specific status code

#### Returns

Promise resolving to response object:

```typescript
{
  statusCode: number;
  body: unknown; // Automatically parsed if JSON
  headers: Record<string, string | string[]>;
}
```

#### Examples

Basic request:

```typescript
const response = await utils.request('POST http://localhost:3000/launches', {
  body: {
    missionName: 'Apollo 11',
    launchDate: '2026-12-31T00:00:00Z',
    rocketType: 'Saturn V',
  },
  headers: {
    'content-type': 'application/json',
  },
});
```

Request without hooks:

```typescript
const response = await utils.request(
  'POST http://localhost:3000/astronauts',
  {
    body: { name: 'Buzz', password: 'secret', role: 'Pilot' },
    headers: { 'content-type': 'application/json' },
  },
  {
    runHooks: false, // Don't execute hooks
  },
);
```

Request specific status code:

```typescript
const response = await utils.request(
  'GET http://localhost:3000/launches/123',
  {},
  {
    forStatusCode: 404, // Use 404 response sample
  },
);
```

### `utils.skip()`

Skip the current test. Execution stops immediately.

```typescript
skip(message: string): never
```

#### Parameters

- **message** (`string`): Reason for skipping the test

#### Example

```typescript
const response = await utils.request('POST http://localhost:3000/launches', {
  body: {
    /* ... */
  },
  headers: { 'content-type': 'application/json' },
});

if (response.statusCode !== 201) {
  utils.skip('Cannot create launch for test');
}
```

### `utils.fail()`

Fail the current test. Execution stops immediately.

```typescript
fail(message: string): never
```

#### Parameters

- **message** (`string`): Reason for test failure

#### Example

```typescript
const response = await utils.request('POST http://localhost:3000/launches', {
  body: {
    /* ... */
  },
  headers: { 'content-type': 'application/json' },
});

if (response.statusCode !== 201) {
  utils.fail(`Expected 201, got ${response.statusCode}`);
}

if (!response.body.id) {
  utils.fail('Response missing required id field');
}
```

### `utils.info()`

Log an informational message in test output.

```typescript
info(message: string): void
```

#### Parameters

- **message** (`string`): Message to log

#### Example

```typescript
utils.info('Creating test user');
const response = await utils.request('POST http://localhost:3000/astronauts', {
  body: {
    /* ... */
  },
  headers: { 'content-type': 'application/json' },
});
utils.info(`User created with ID: ${response.body.id}`);
```

**Output:**

```
POST /launches
  ℹ Creating test user
  ℹ User created with ID: abc123
  ✓ 201 Created (15ms)
```

### `utils.warn()`

Log a warning message in test output.

```typescript
warn(message: string, details?: string): void
```

#### Parameters

- **message** (`string`): Warning message
- **details** (`string`, optional): Additional details

#### Example

```typescript
if (response.headers['x-rate-limit-remaining'] === '1') {
  utils.warn('Rate limit almost exhausted', 'Only 1 request remaining');
}
```

**Output:**

```
POST /launches
  ⚠ Rate limit almost exhausted (Only 1 request remaining)
  ✓ 201 Created (15ms)
```

### `utils.assertionSuccess()`

Record a successful assertion.

```typescript
assertionSuccess(message: string, assertion?: string): void
```

#### Parameters

- **message** (`string`): Assertion description
- **assertion** (`string`, optional): Short assertion label

#### Example

```typescript
const response = await utils.request('GET http://localhost:3000/launches', {});

if (response.body.length > 0) {
  utils.assertionSuccess('Response contains launches', 'has launches');
}
```

**Output:**

```
GET /launches
  ✓ has launches
  ✓ 200 OK (8ms)
```

### `utils.assertionFailure()`

Record a failed assertion. Test continues (unlike `fail()`).

```typescript
assertionFailure(
  message: string,
  details?: {
    assertion?: string;
    expected?: unknown;
    actual?: unknown;
  }
): void
```

#### Parameters

- **message** (`string`): Assertion description
- **details** (optional): Assertion details
  - `assertion`: Short assertion label
  - `expected`: Expected value
  - `actual`: Actual value

#### Example

```typescript
const body = JSON.parse(response.body || '{}');

if (!body.id) {
  utils.assertionFailure('Missing id field', {
    assertion: 'has id',
    expected: 'id field present',
    actual: 'id field missing',
  });
}

if (!body.missionName) {
  utils.assertionFailure('Missing missionName field', {
    assertion: 'has missionName',
    expected: 'missionName field present',
    actual: 'missionName field missing',
  });
}
```

**Output:**

```
POST /launches
  ✗ has id (expected: "id field present", actual: "id field missing")
  ✗ has missionName (expected: "missionName field present", actual: "missionName field missing")
  ✓ 201 Created (12ms)
```

### `utils.timeout()`

Record a timeout event in test results.

```typescript
timeout(message: string, durationMs: number): void
```

#### Parameters

- **message** (`string`): Timeout description
- **durationMs** (`number`): Duration in milliseconds

#### Example

```typescript
const start = Date.now();
const response = await utils.request('POST http://localhost:3000/launches', {
  body: {
    /* ... */
  },
  headers: { 'content-type': 'application/json' },
});
const duration = Date.now() - start;

if (duration > 1000) {
  utils.timeout('Launch creation took too long', duration);
}
```

### `utils.randomString()`

Generate a random alphanumeric string.

```typescript
randomString(length?: number): string
```

#### Parameters

- **length** (`number`, optional): String length (default: 10)

#### Returns

Random string containing letters (a-z, A-Z) and numbers (0-9)

#### Examples

```typescript
const username = utils.randomString(); // "k8jF2mN9pL" (10 chars)
const password = utils.randomString(16); // "Lm8Np6Oq1sTk4Jh7" (16 chars)
const id = utils.randomString(32); // 32-character string
```

**Use cases:**

- Generating unique usernames
- Creating random passwords
- Generating unique IDs
- Creating random data for tests
