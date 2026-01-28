---
title: Why Provide Request Files for each Endpoint?
description: Understanding why sampler requires explicit request samples for every endpoint, including error cases.
---

import { FileTree, Aside } from '@astrojs/starlight/components';

Understanding why sampler requires explicit request samples for every endpoint, including error cases.

## The Requirement

The sampler plugin requires a `request.json` file for every endpoint and status code combination defined in your OpenAPI specification:

<FileTree>

- launches/
  - @GET/
    - 200/
      - application\_\_json/
        - request.json ← Success case
  - @POST/
    - application\_\_json/
      - 201/
        - application\_\_json/
          - request.json ← Success case
      - 400/
        - application\_\_json/
          - request.json ← Bad request case
      - 422/
        - application\_\_json/
          - request.json ← Validation error case
  - [id]/
    - @GET/
      - 200/
        - application\_\_json/
          - request.json ← Found case
      - 404/
        - application\_\_json/
          - request.json ← Not found case
    - @DELETE/
      - 204/
        - application\_\_json/
          - request.json ← Success case
      - 404/
        - application\_\_json/
          - request.json ← Not found case

</FileTree>

## Why Is This Required?

### 1. Forces Complete API Testing

Without explicit request files, it's easy to skip testing important scenarios.

#### The Problem Without Request Files

Many testing approaches only test "happy paths":

```javascript
// Common pattern - only tests success
test('GET /launches', async () => {
  const response = await fetch('/launches');
  expect(response.status).toBe(200);
});
```

**What's missing:**

- ❌ No test for unauthorized access (401)
- ❌ No test for rate limiting (429)

However, the contract between client and server includes not only the 2xx status codes but also the 4xx status codes. Not testing these would mean ignoring an important aspect of the API and its contract.

#### With Request Files

```
launches/@GET/
├── 200/           ← Happy path
├── 401/           ← Unauthorized
├── 429/           ← Rate limited
```

**Result:**

- ✅ All documented scenarios must be tested
- ✅ Can't forget error cases
- ✅ Test coverage matches specification

### 2. HTTP Conformance Testing

Request files enable automated testing of HTTP conformance:

#### Response Status Codes

Each request file is tied to an expected status code:

```
launches/@POST/
├── 201/           ← Expects 201 Created
│   └── request.json
├── 400/           ← Expects 400 Bad Request
│   └── request.json
└── 422/           ← Expects 422 Unprocessable Entity
    └── request.json
```

Thymian automatically verifies:

- ✅ Response status matches expected status
- ✅ Response body matches OpenAPI schema
- ✅ Response headers match specification
-

#### Schema Validation

With request files, Thymian validates:

**Request schema:**

```json
{
  "body": {
    "missionName": "Apollo 11",   ← Must match schema
    "launchDate": "2026-07-20",   ← Must match date format
    "rocketType": "Saturn V"       ← Must match enum values
  }
}
```

**Response schema:**
Automatically validated against OpenAPI specification.

### 3. Error Responses Are Part of the API Contract

Error responses are just as important as success responses for API usability.

#### Why Test Error Cases?

**Consider this scenario:**

Your API returns 400 for invalid input:

```json
{
  "error": "Invalid launch date"
}
```

But the specification says it should be:

```json
{
  "error": {
    "message": "Invalid launch date",
    "code": "INVALID_DATE",
    "field": "launchDate"
  }
}
```

**Without testing:** Clients get unhelpful error messages and can't parse errors properly.

**With testing:** Error responses are validated against the specification, ensuring consistent error handling.

#### Real-World Impact

Poor error messages frustrate developers:

**Bad (not tested):**

```
Error 400
```

**Good (tested):**

```
{
  "error": {
    "message": "launchDate must be in ISO 8601 format",
    "code": "INVALID_DATE_FORMAT",
    "field": "launchDate",
    "provided": "2026-13-01",
    "example": "2026-12-01T00:00:00Z"
  }
}
```

Testing error responses ensures:

- ✅ Helpful error messages
- ✅ Consistent error format
- ✅ Machine-parseable errors
- ✅ Good developer experience

### 4. Enables Targeted Testing

Request files allow testing specific scenarios without hooks:

#### Testing 404 Responses

```json
{
  "path": "/api/v1/launches/{id}",
  "method": "GET",
  "pathParameters": {
    "id": "nonexistent-id-123"
  }
}
```

The file lives in `launches/[id]/@GET/404/`:

- Expectation: 404 Not Found
- No need to create a resource first
- Tests the "not found" case explicitly

#### Testing Validation Errors

```json
{
  "path": "/api/v1/launches",
  "method": "POST",
  "body": {
    "missionName": "",           ← Invalid: empty string
    "launchDate": "invalid",     ← Invalid: bad format
    "rocketType": "UnknownRocket" ← Invalid: not in enum
  }
}
```

The file lives in `launches/@POST/400/`:

- Expectation: 400 Bad Request
- Tests validation logic
- Verifies error messages

### 5. Documentation Through Examples

Request files serve as executable documentation:

#### Self-Documenting Tests

```
launches/@POST/201/application__json/request.json
```

This file shows:

- ✅ What a valid request looks like
- ✅ What fields are required
- ✅ What values are acceptable
- ✅ What the happy path is

#### Living Examples

Unlike documentation that goes stale:

- Request files are always up-to-date (or tests fail)
- They show real, working examples
- They demonstrate edge cases

#### Onboarding

New developers can:

- Browse request files to understand the API
- Copy request examples for their own code
- See how to trigger different responses

### 6. Ensures Specification Completeness

Requiring request files highlights gaps in your OpenAPI specification:

#### Missing Status Codes

If you can't generate a request for a status code, it's probably not documented:

```yaml
# Missing 401 response
/api/v1/launches:
  get:
    responses:
      200:
        description: Success
      # Where's 401? 500?
```

**Result:** Forces you to document all responses.

#### Incomplete Schemas

If you can't generate valid request data, your schema is incomplete:

```yaml
# Missing required fields
LaunchInput:
  type: object
  properties:
    missionName:
      type: string
  # Missing: launchDate, rocketType
```

**Result:** Forces complete schema definitions.

## Common Objections

### "Can't we just use one request file per endpoint?"

**Problem:** You'd miss testing error cases.

**Example:**

```
launches/@POST/
└── request.json  ← Only tests 201 Created
```

**Missing:**

- 400 Bad Request
- 401 Unauthorized
- 422 Validation Error

**Result:** Incomplete test coverage, bugs in error handling.

### "Can't hooks generate the data dynamically?"

**Yes, but:** Request files establish the baseline.

**Without request files:**

```typescript
// Where does this data come from?
const hook: BeforeEachRequestHook = async (request, context, utils) => {
  request.body = /* what should be here? */;
  return request;
};
```

**With request files:**

```typescript
// Request file provides the baseline
// Hook modifies it as needed
const hook: BeforeEachRequestHook = async (request, context, utils) => {
  request.body.missionName = utils.randomString(10); // Modify
  return request;
};
```

**Benefits:**

- ✅ Clear baseline
- ✅ Hooks modify, not create from scratch
- ✅ Request files document expected structure

### "Isn't this a lot of files?"

**Yes, but:**

**For a 50-endpoint API with 3 status codes each:**

- 150 request files
- Organized in a hierarchy
- Easy to navigate
- Each file is small and focused

**Alternative:**

- One large file with all tests (harder to maintain)
- Code-based setup (harder to share and review)
- No structure (chaos)

**Trade-off:** More files, but better organization.

## Real-World Benefits

### Caught a Bug

```
DELETE /api/v1/launches/{id}
  ✗ Expected 204, got 200
  ✗ Body should be empty
```

**Found:** API returns 200 with empty body instead of 204.

**Impact:** Violates HTTP semantics, confuses clients.

### Inconsistent Errors

```
POST /api/v1/launches
  ✗ 400 response body doesn't match schema

Expected:
{
  "error": {
    "message": "...",
    "code": "...",
    "field": "..."
  }
}

Actual:
{
  "message": "..."
}
```

**Found:** Error format inconsistent with specification.

**Impact:** Clients can't parse errors reliably.

### Missing Status Code

```
✗ No request file for: GET /api/v1/launches -> 401
```

**Found:** Forgot to document unauthorized response.

**Impact:** Specification incomplete.

## Conclusion

Requiring request files for each endpoint and status code:

1. **Forces complete testing** - Can't skip error cases
2. **Enables HTTP conformance testing** - Validates responses automatically
3. **Treats errors as first-class citizens** - Ensures good error handling
4. **Enables targeted testing** - Test specific scenarios easily
5. **Documents through examples** - Shows how to use the API
6. **Ensures specification quality** - Highlights gaps and inconsistencies

This requirement drives **better API design**, **complete testing**, and **reliable implementations**.
