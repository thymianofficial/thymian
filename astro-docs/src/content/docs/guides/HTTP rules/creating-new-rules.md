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

Point the CLI at the generated `.ts` file and it runs — **no build, no bundler, no Node
flags.** `thymian generate rule` only ever emits a file that loads: `.ts` by default, `.cjs`
under `--cjs`, and **never** `.mts`/`.cts`. If `--output` names an extension that conflicts
with the mode (e.g. `--cjs --output foo.js`), the command declines rather than silently
rewriting your path.

:::note
`erasableSyntaxOnly` is **not** required of your rule code. That restriction belongs to Node's
own type-stripping feature, which Thymian's loader does not use — loading goes through [jiti](https://github.com/unjs/jiti)
instead, so `enum`, `namespace`, parameter properties, and decorators all load normally. See
[Loading Rules and Plugins](/references/loading-rules-and-plugins/) for the full loading
contract.
:::

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

Add the validation logic using the common interface. Every validation call names two roles with separate keys:

```typescript
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCode(201),
      violatedWhen: not(responseHeader('location')),
    })
  )
```

This rule:

1. Applies to all transactions with status 201 (`appliesTo`)
2. Reports a violation when the `Location` header is missing (`violatedWhen`)

### Applicability and Violation Condition

- **`appliesTo`** is the rule's **Applicability**: which transactions the rule speaks about, such as "responses with status 201". It is required.
- **`violatedWhen`** is the rule's **Violation Condition**: what is wrong with an applicable transaction, such as "no `Location` header". It is required too. It is either a filter expression (the rule is violated when it matches) or a function that returns results. It runs only on transactions that `appliesTo` accepts.

A transaction outside the rule's applicability is never a violation. Leaving out either key is a compile error.

Both keys are evaluated against whatever the command observes:

| Command   | `appliesTo` is checked against                                                                                       | `violatedWhen` is checked against |
| --------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `lint`    | the API specification                                                                                                | the same described transaction    |
| `analyze` | the recorded request and response                                                                                    | the same recorded pair            |
| `test`    | the specification, to choose which requests to send, **and then again** against the response that actually came back | the response that came back       |

In `test`, `appliesTo` therefore acts twice. A rule for 405 responses sends requests to operations the specification describes as answering 405, but stays silent when the server answers 204.

:::caution
Put a fact that only live traffic carries in `violatedWhen`, not in `appliesTo`. A header such as `Content-Length` or `Content-Type` is never declared in an OpenAPI description, so a specification cannot answer `responseHeader('content-length')`. In `appliesTo` it would select nothing in `test`, and no request would be sent. Select the transactions by what the specification does know, such as status code and method, and state the live-only part in `violatedWhen`.
:::

### Step 4: Complete the Rule

Always end with `.done()`:

```typescript
  .done();
```

## Complete Example

Here's a complete rule that enforces API versioning through custom headers:

```typescript
import { httpRule } from '@thymian/core';
import { constant, not, requestHeader } from '@thymian/core';

export default httpRule('require-api-version-header')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://api-guidelines.mycompany.com/versioning')
  .description('All API requests must include X-API-Version header')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions({ appliesTo: constant(true), violatedWhen: not(requestHeader('x-api-version')) }))
  .done();
```

## Validation Patterns

There are three main patterns for writing the Violation Condition. `appliesTo` is always a filter expression; what changes is the form of `violatedWhen`.

### Pattern 1: Expression Condition

Use a filter expression when a simple match says what is wrong:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions({
    appliesTo: method('DELETE'),                   // Select DELETE requests
    violatedWhen: not(statusCodeRange(200, 204)),  // Flag if status not 200-204
  })
)
```

Every applicable transaction that matches `violatedWhen` produces one violation.

### Pattern 2: Function Condition

Use a function for conditions an expression can't express, such as parsing a header value, comparing dates or diffing two responses. The function runs only on transactions that `appliesTo` accepts and returns the violations it finds:

```typescript
import { getHeader } from '@thymian/core';

.rule((ctx) =>
  ctx.validateHttpTransactions({
    appliesTo: statusCode(401),
    violatedWhen: (request, response, location) => {
      const authHeader = getHeader(response.headers, 'www-authenticate');

      // A live-only fact, checked on the response that actually came back
      return typeof authHeader === 'undefined' || !isValidAuthHeader(authHeader)
        ? [{ location, violation: {}, findings: [] }]
        : [];
    },
  })
)
```

### Pattern 3: Grouped Transactions

Use the grouped variant when a violation depends on several transactions together, such as the same URL answered to `GET` and `HEAD`. It takes the same `appliesTo` and `violatedWhen` keys, plus a `groupBy` expression. `violatedWhen` is a function that receives each group, and only applicable transactions reach it:

```typescript
.rule((ctx) =>
  ctx.validateGroupedCommonHttpTransactions({
    appliesTo: and(statusCode(200), or(method('GET'), method('HEAD'))),
    groupBy: url(),
    violatedWhen: (_group, transactions) => {
      const head = transactions.find(([req]) => equalsIgnoreCase(req.method, 'head'));
      const get = transactions.find(([req]) => equalsIgnoreCase(req.method, 'get'));

      if (!head || !get) return [];

      const [, headResponse, location] = head;
      const [, getResponse] = get;

      return headResponse.headers.length < getResponse.headers.length
        ? [{ location, violation: { message: 'HEAD response is missing headers that GET carries' }, findings: [] }]
        : [];
    },
  })
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
  .rule((ctx) => ctx.validateCommonHttpTransactions({ appliesTo: statusCodeRange(400, 599), violatedWhen: not(responseMediaType('application/problem+json')) }))
  .done();
```

### Example 2: Enforce Correlation ID Tracking

Ensure distributed tracing by requiring correlation IDs:

```typescript
import { httpRule } from '@thymian/core';
import { constant, not, requestHeader } from '@thymian/core';

export default httpRule('require-correlation-id')
  .severity('warn')
  .type('static', 'analytics')
  .description('Requests should include X-Correlation-ID for distributed tracing')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions({ appliesTo: constant(true), violatedWhen: not(requestHeader('x-correlation-id')) }))
  .done();
```

### Example 3: Require Deprecation Headers

Ensure deprecated endpoints include proper sunset notices:

```typescript
import { httpRule } from '@thymian/core';
import { path, not, responseHeader } from '@thymian/core';

export default httpRule('deprecated-endpoints-require-sunset')
  .severity('error')
  .type('static', 'analytics')
  .description('Deprecated API endpoints must include Sunset header')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions({ appliesTo: path('/api/v1/*'), violatedWhen: not(responseHeader('sunset')) }))
  .done();
```

## Advanced: Custom Validation Functions

When an expression isn't sufficient, make `violatedWhen` a function:

```typescript
import { httpRule } from '@thymian/core';
import { responseHeader, getHeader } from '@thymian/core';

export default httpRule('validate-cache-control-directives')
  .severity('warn')
  .type('test', 'analytics')
  .description('Cache-Control header must include valid directives')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateHttpTransactions({
      appliesTo: responseHeader('cache-control'),
      violatedWhen: (request, response, location) => {
        const cacheControl = getHeader(response.headers, 'cache-control');

        // Custom parsing and validation
        const directives = parseCacheControl(cacheControl);

        // Return a result for every violation detected
        return hasValidDirectives(directives) ? [] : [{ location, violation: {}, findings: [] }];
      },
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

## Next Steps

Now that you know how to create rules:

- Explore [rule types in depth](/concepts/rule-types/) to understand context-specific features
- Learn about [combining rule types](/guides/http-rules/combining-types/) for hybrid rules
- See [how to use rules](/guides/http-rules/how-to-use-rules/) in your projects
