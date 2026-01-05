---
title: 'Creating New Rules'
description: 'Step-by-step guide to writing HTTP validation rules'
---

Creating HTTP validation rules in Thymian is straightforward. You can generate a rule scaffold using the CLI or write one from scratch. This guide walks you through both approaches.

## Quick Start with CLI

The fastest way to create a new rule is using the interactive CLI generator:

```bash
thymian http-linter:generate
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
import { httpRule } from '@thymian/http-linter';

export default httpRule('your-rule-name').severity('error').type('static', 'analytics').description('Your rule description').appliesTo('server').done();
```

## Writing a Rule from Scratch

### Step 1: Set Up Imports

Start by importing the necessary components:

```typescript
import { httpRule } from '@thymian/http-linter';
import { statusCode, not, responseHeader } from '@thymian/core';
```

The `@thymian/core` package provides filter expressions for matching HTTP transactions.

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

Here's a complete rule that ensures POST requests returning 201 include a Location header:

```typescript
import { httpRule } from '@thymian/http-linter';
import { and, method, statusCode, not, responseHeader } from '@thymian/core';

export default httpRule('post-201-requires-location')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#status.201')
  .description('POST requests that return 201 must include Location header')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(method('POST'), statusCode(201)), not(responseHeader('location'))))
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
    and(method('GET'), statusCode(200)), // For a successful GET
    not(hasResponseBody())               // It is a violation if it has NO body
  )
)
```

### Pattern 3: Custom Validation Function

Use a function for complex logic that requires examining the transaction details:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    responseHeader('www-authenticate'),
    (request, response) => {
      // Access the full response via ctx.format
      const fullResponse = ctx.format.getNode(response.id);
      const authHeader = fullResponse.headers['www-authenticate'];

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
```

### Complete Filter Reference

See the [API documentation](https://docs.thymian.dev/api/filters) for a complete list of available filters.

## Real-World Examples

### Example 1: Enforce Consistent Error Format

Ensure all error responses use Problem Details format:

```typescript
import { httpRule } from '@thymian/http-linter';
import { statusCodeRange, not, responseMediaType } from '@thymian/core';

export default httpRule('errors-use-problem-details')
  .severity('warn')
  .type('static', 'analytics')
  .description('Error responses should use application/problem+json format')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCodeRange(400, 599), not(responseMediaType('application/problem+json'))))
  .done();
```

### Example 2: Validate Authentication Flow

Check that 401 responses include proper authentication challenges:

```typescript
import { httpRule } from '@thymian/http-linter';
import { statusCode, not, responseHeader } from '@thymian/core';

export default httpRule('401-requires-auth-challenge')
  .severity('error')
  .type('static', 'analytics', 'test')
  .description('401 responses must include WWW-Authenticate header')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  .done();
```

### Example 3: Prevent Breaking Changes

Ensure endpoints don't return 410 Gone for resources that should exist:

```typescript
import { httpRule } from '@thymian/http-linter';
import { and, statusCode, path } from '@thymian/core';

export default httpRule('no-410-on-active-endpoints')
  .severity('error')
  .type('analytics')
  .description('Active API endpoints should not return 410 Gone')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(path('/api/*'), statusCode(410))))
  .done();
```

## Advanced: Custom Validation Functions

When filters aren't sufficient, use custom validation functions:

```typescript
import { httpRule } from '@thymian/http-linter';
import { responseHeader } from '@thymian/core';

export default httpRule('validate-cache-control-directives')
  .severity('warn')
  .type('static', 'analytics')
  .description('Cache-Control header must include valid directives')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(responseHeader('cache-control'), (request, response) => {
      // Get full response to access header values
      const fullResponse = ctx.format.getNode(response.id);
      const cacheControl = fullResponse.headers['cache-control'];

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

## File Organization

Organize your rules logically:

```
rules/
├── authentication/
│   ├── 401-requires-www-authenticate.rule.ts
│   └── authorization-header-format.rule.ts
├── error-handling/
│   ├── errors-use-problem-details.rule.ts
│   └── 500-includes-content-type.rule.ts
└── methods/
    ├── get-no-body.rule.ts
    └── post-returns-201.rule.ts
```

**Best practices:**

- Group related rules in directories
- Use descriptive file names ending in `.rule.ts`
- Export default from each rule file
- Keep rules focused on a single concern

## Testing Your Rules

To test your rules locally:

1. **Create a test API specification or traffic sample**
2. **Configure Thymian to load your rule:**

```typescript
// thymian.config.ts
export default {
  plugins: [
    {
      plugin: '@thymian/http-linter',
      options: {
        rules: ['./rules/**/*.rule.ts'],
        modes: ['static'],
      },
    },
  ],
};
```

3. **Run Thymian:**

```bash
thymian run
```

4. **Verify violations are reported correctly**

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

### 3. Not Handling Optional Values

When using custom validation functions, check for undefined:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    responseHeader('location'),
    (request, response) => {
      const fullResponse = ctx.format.getNode(response.id);

      // ❌ May throw if header missing
      const location = fullResponse.headers['location'];

      // ✅ Check for existence first
      if (!fullResponse || !fullResponse.headers['location']) {
        return false;
      }

      const location = fullResponse.headers['location'];
      return !isValidUrl(location);
    }
  )
)
```

## Next Steps

Now that you know how to create rules:

- Explore [rule types in depth](./rule-types.md) to understand context-specific features
- Learn about [combining rule types](./combining-types.md) for hybrid rules
- See [how to use rules](./how-to-use-rules.md) in your projects
