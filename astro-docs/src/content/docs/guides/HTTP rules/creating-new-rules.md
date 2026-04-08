---
title: 'Creating New Rules'
description: 'Step-by-step guide to writing HTTP validation rules'
sidebar:
  order: 2
---

Creating HTTP validation rules in Thymian is straightforward. You can generate a rule scaffold using the CLI or write one from scratch. This guide walks you through both approaches.

## Quick Start with CLI

The fastest way to create a new rule is using the interactive CLI generator:

```bash
thymian generate rule
```

This command guides you through the rule creation process:

1. **Rule name** — Unique identifier for your rule
2. **Severity** — `error`, `warn`, or `hint`
3. **URL** — Link to documentation (optional)
4. **Description** — What the rule validates
5. **Rule types** — One or more of: `static`, `analytics`, `test`, `informational`
6. **Applies to** — Target participants: `client`, `server`, `proxy`, etc.

The CLI generates a rule template that you can copy into your project:

```typescript
import { httpRule } from '@thymian/core';

export default httpRule('your-rule-name').severity('error').type('static', 'analytics').description('Your rule description').appliesTo('server').done();
```

## Writing a Rule from Scratch

### Step 1: Set Up Imports

Start by importing the necessary components:

```typescript
import { httpRule, statusCode, not, responseHeader } from '@thymian/core';
```

The `@thymian/core` package provides both the rule builder and filter expressions for matching HTTP transactions.

### Step 2: Define Rule Metadata

Create the rule with its basic metadata:

```typescript
export default httpRule('ensure-location-on-201').severity('error').type('static', 'analytics', 'test').description('201 Created responses must include a Location header').appliesTo('server');
```

**Best practices:**

- Use descriptive names in kebab-case
- Choose appropriate severity based on requirement criticality
- Include clear descriptions that explain what is validated

### Step 3: Add Validation Logic

Add the validation logic using the common interface:

```typescript
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(201),
      not(responseHeader('location'))
    )
  )
```

This rule:

1. Finds all transactions with status 201
2. Reports violations when the `Location` header is missing

### Step 4: Complete the Rule

Always end with `.done()`:

```typescript
  .done();
```

## Complete Example

Here's a complete rule that enforces API versioning through custom headers:

```typescript
import { httpRule } from '@thymian/core';
import { not, requestHeader } from '@thymian/core';

export default httpRule('require-api-version-header')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://api-guidelines.mycompany.com/versioning')
  .description('All API requests must include X-API-Version header')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(not(requestHeader('x-api-version'))))
  .done();
```

## Validation Patterns

There are three main patterns for writing validation logic:

### Pattern 1: Transaction + Violation Filters

Use two filters—one to select transactions, another to find violations:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    method('DELETE'),           // Select DELETE requests
    not(statusCodeRange(200, 204))  // Flag if status not 200-204
  )
)
```

### Pattern 2: Single Violation Filter

Use one filter when matching it is itself the violation:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    and(method('GET'), statusCode(200), hasRequestBody()), // GET should not have request body
  )
)
```

### Pattern 3: Custom Validation Function

Use a function for complex logic that requires examining the transaction details:

```typescript
import { getHeader } from '@thymian/core';

.
rule((ctx) =>
  ctx.validateHttpTransactions(
    responseHeader('www-authenticate'),
    (request, response) => {
      const authHeader = getHeader(response.headers, 'www-authenticate');

      // Custom validation logic
      return !isValidAuthHeader(authHeader);
    }
  )
)
```

## Common Filter Expressions

Filter expressions from `@thymian/core` let you declaratively match HTTP transactions:

### Request Filters

```typescript
method('GET'); // Match HTTP method
requestHeader('content-type'); // Match header presence
hasRequestBody(); // Has request body
requestMediaType('application/json'); // Match content type
authorization(); // Has authorization
```

### Response Filters

```typescript
statusCode(404); // Match status code
statusCodeRange(400, 499); // Match status range
responseHeader('location'); // Match header presence
hasResponseBody(); // Has response body
responseMediaType('application/json'); // Match content type
```

### Logical Operators

```typescript
and(method('POST'), statusCode(201)); // Both must match
or(statusCode(301), statusCode(302)); // Either can match
not(responseHeader('location')); // Must NOT match
xor(...);
```

## Real-World Examples

### Example 1: Enforce Consistent Error Format

Ensure all error responses use Problem Details format:

```typescript
import { httpRule } from '@thymian/core';
import { statusCodeRange, not, responseMediaType } from '@thymian/core';

export default httpRule('errors-use-problem-details')
  .severity('warn')
  .type('static', 'analytics')
  .description('Error responses should use application/problem+json format')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCodeRange(400, 599), not(responseMediaType('application/problem+json'))))
  .done();
```

### Example 2: Enforce Correlation ID Tracking

Ensure distributed tracing by requiring correlation IDs:

```typescript
import { httpRule } from '@thymian/core';
import { not, requestHeader } from '@thymian/core';

export default httpRule('require-correlation-id')
  .severity('warn')
  .type('static', 'analytics')
  .description('Requests should include X-Correlation-ID for distributed tracing')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(not(requestHeader('x-correlation-id'))))
  .done();
```

### Example 3: Require Deprecation Headers

Ensure deprecated endpoints include proper sunset notices:

```typescript
import { httpRule } from '@thymian/core';
import { and, path, not, responseHeader } from '@thymian/core';

export default httpRule('deprecated-endpoints-require-sunset')
  .severity('error')
  .type('static', 'analytics')
  .description('Deprecated API endpoints must include Sunset header')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(path('/api/v1/*')), not(responseHeader('sunset'))))
  .done();
```

## Advanced: Custom Validation Functions

When filters aren't sufficient, use custom validation functions:

```typescript
import { httpRule } from '@thymian/core';
import { responseHeader, getHeader } from '@thymian/core';

export default httpRule('validate-cache-control-directives')
  .severity('warn')
  .type('test', 'analytics')
  .description('Cache-Control header must include valid directives')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(responseHeader('cache-control'), (request, response) => {
      const cacheControl = getHeader(response.headers, 'cache-control');

      // Custom parsing and validation
      const directives = parseCacheControl(cacheControl);

      // Return true if violation detected
      return !hasValidDirectives(directives);
    }),
  )
  .done();

function parseCacheControl(header: string) {
  // Your parsing logic
}

function hasValidDirectives(directives: any) {
  // Your validation logic
}
```

## Common Pitfalls

### 1. Forgetting `.done()`

Always end your rule definition with `.done()`:

```typescript
// ❌ Missing .done()
export default httpRule('my-rule')
  .severity('error')
  .type('static')
  .rule((ctx) => { ... });

// ✅ Correct
export default httpRule('my-rule')
  .severity('error')
  .type('static')
  .rule((ctx) => { ... })
  .done();  // Don't forget!
```

### 2. Using Wrong Filter Combination

Ensure your filter logic matches your intent:

```typescript
// ❌ This will never match (GET is not POST)
and(method('GET'), method('POST'));

// ✅ Use OR for alternatives
or(method('GET'), method('POST'));
```
