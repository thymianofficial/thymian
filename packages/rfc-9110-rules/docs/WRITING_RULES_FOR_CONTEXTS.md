# Writing Thymian Rules for Static and Analytical Contexts

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding Rule Contexts](#understanding-rule-contexts)
3. [The Common Interface](#the-common-interface)
4. [Static-Only Rules](#static-only-rules)
5. [Analytics-Only Rules](#analytics-only-rules)
6. [Test-Only Rules](#test-only-rules)
7. [Hybrid Rules](#hybrid-rules)
8. [Context-Specific Overrides](#context-specific-overrides)
9. [Best Practices](#best-practices)
10. [Complete Examples](#complete-examples)

---

## Introduction

Thymian rules can execute in three different contexts: **static**, **analytics**, and **test**. Each context provides different capabilities and serves different purposes:

- **Static context**: Analyzes OpenAPI specifications without executing any HTTP traffic
- **Analytics context**: Analyzes recorded HTTP transactions from a SQLite database
- **Test context**: Generates and executes live HTTP tests against running servers

This document explains how to write rules for each context, when to use each one, and how to create hybrid rules that work across multiple contexts.

---

## Understanding Rule Contexts

### Static Context

**Purpose**: Validate API specifications before implementation

**Data Source**: ThymianFormat (OpenAPI specification graph)

**Capabilities**:

- Access to the complete OpenAPI specification graph
- Analyze request/response definitions from the spec
- Validate JSON schemas
- Check header definitions, status codes, methods
- Fast execution (no network calls)

**Limitations**:

- Cannot validate actual runtime behavior
- Cannot check real request/response bodies
- Cannot verify server compliance with spec

**When to use**:

- Validating API design constraints
- Checking specification completeness
- Ensuring consistency in API definitions
- Rules that can be verified from the specification alone

---

### Analytics Context

**Purpose**: Analyze actual HTTP traffic that has been recorded

**Data Source**: SQLite database with recorded HTTP transactions

**Capabilities**:

- Access to real HTTP requests and responses
- SQL-based querying for efficient filtering
- Analyze actual headers, status codes, bodies
- Compare multiple transactions
- Validate runtime behavior

**Limitations**:

- Requires recorded transaction data
- Cannot actively test (passive analysis only)
- Depends on transaction coverage

**When to use**:

- Analyzing real-world HTTP traffic
- Validating server responses to actual requests
- Checking authentication flows
- Rules that require inspecting actual HTTP data

---

### Test Context

**Purpose**: Actively test HTTP endpoints by generating and executing requests

**Data Source**: ThymianFormat + live HTTP requests/responses

**Capabilities**:

- Generate test requests based on specification
- Execute requests against live servers
- Validate responses
- Test edge cases and error scenarios
- Discover issues through active probing

**Limitations**:

- Requires running server
- Can be slow (network latency)
- May affect server state

**When to use**:

- Proactively testing server compliance
- Verifying server capabilities (e.g., support for GET/HEAD)
- Testing error handling
- Rules that need to actively probe endpoints

---

## The Common Interface

The most powerful feature of Thymian rules is the **common interface**, which allows you to write validation logic once and have it automatically work across all three contexts (static, analytics, and test).

### How It Works

When you use the `.rule()` method on the rule builder, you're using the common interface. This interface provides two main methods:

1. **`validateCommonHttpTransactions(filter, validate?)`**
2. **`validateGroupedCommonHttpTransactions(filter, groupBy, validate)`**

These methods accept **filter expressions** and **validation functions** that work with a simplified HTTP transaction model.

### The Common HTTP Transaction Model

Both methods work with simplified request/response objects:

```typescript
type CommonHttpRequest = {
  id: string;
  origin: string;
  path: string;
  method: string;
  headers: string[]; // Array of header names only
  queryParameters: string[];
  cookies: string[];
  mediaType: string;
  body: boolean; // Just presence, not content
};

type CommonHttpResponse = {
  id: string;
  statusCode: number;
  mediaType: string;
  headers: string[]; // Array of header names only
  body: boolean; // Just presence, not content
  trailers: string[];
};
```

### Automatic Context Translation

The rule builder automatically translates your common interface logic to each context:

- **Static context**: Extracts transaction data from ThymianFormat graph
- **Analytics context**: Queries SQLite database and retrieves transactions
- **Test context**: Generates tests, executes them, and validates results

### When to Use the Common Interface

Use `.rule()` with the common interface when:

- Your validation logic can work with the simplified transaction model
- You want the rule to work in multiple contexts automatically
- You only need to check header presence, status codes, methods, etc.
- You don't need access to actual header values or body content

### When NOT to Use the Common Interface

Use context-specific overrides when:

- You need to parse header values or body content
- You need access to JSON schemas (static)
- You need to run custom SQL queries (analytics)
- You need custom test generation logic (test)
- The simplified model doesn't provide enough information

---

## Static-Only Rules

### Creating a Static-Only Rule

To create a rule that only runs in static context:

```typescript
import { method, hasRequestBody } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/example-static-only-rule')
  .severity('error')
  .type('static') // Only static context
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section')
  .description('Example static-only rule')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(method('TRACE'), hasRequestBody()))
  .done();
```

### Using Static Context API Directly

For more control, use `overrideStaticRule()` to access the `StaticApiContext` API:

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/example-static-advanced')
  .severity('error')
  .type('static')
  .description('Advanced static rule with direct API access')
  .appliesTo('server')
  .overrideStaticRule((ctx) => {
    // Access ThymianFormat directly
    const format = ctx.format;

    // Get all HTTP transactions
    const transactions = format.getHttpTransactions();

    const violations = [];

    for (const [reqId, resId, transactionId] of transactions) {
      const req = format.getNode(reqId);
      const res = format.getNode(resId);

      // Custom validation logic
      if (req && res && someCondition(req, res)) {
        violations.push({
          location: {
            elementType: 'edge',
            elementId: transactionId,
          },
        });
      }
    }

    return violations;
  })
  .done();
```

### Static Context API Reference

**Properties:**

- `ctx.format: ThymianFormat` - The complete OpenAPI specification graph

**Methods:**

- `ctx.validateCommonHttpTransactions(filter, validate?)` - Common interface
- `ctx.validateGroupedCommonHttpTransactions(filter, groupBy, validate)` - Common interface
- `ctx.validateHttpTransactions(filterFn, validationFn?)` - Low-level API with full ThymianHttpRequest/Response objects

**Common Pattern: Accessing Full Request/Response Data**

When using the common interface but needing access to full data:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    responseHeader('www-authenticate'),
    (req, res) => {
      // Access full response node from format
      const fullResponse = ctx.format.getNode<ThymianHttpResponse>(res.id);
      if (!fullResponse) return false;

      // Now you can access actual header values
      const wwwAuth = fullResponse.headers['www-authenticate'];

      // Custom parsing/validation
      return validateAuthHeader(wwwAuth);
    }
  )
)
```

---

## Analytics-Only Rules

### Creating an Analytics-Only Rule

To create a rule that only runs in analytics context:

```typescript
import { method, hasRequestBody } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/example-analytics-only-rule')
  .severity('error')
  .type('analytics') // Only analytics context
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section')
  .description('Example analytics-only rule')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  .done();
```

### Using Analytics Context API Directly

For custom SQL queries or advanced analytics, use `overrideAnalyticsRule()`:

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/example-analytics-advanced')
  .severity('error')
  .type('analytics')
  .description('Advanced analytics rule with custom SQL')
  .appliesTo('server')
  .overrideAnalyticsRule((ctx) => {
    // Access the SQLite database directly
    const db = ctx.repository.db;

    // Execute custom SQL query
    const query = `
      SELECT transaction_id, request, response
      FROM http_transactions
      WHERE response_status = 401
    `;

    const stmt = db.prepare(query);
    const violations = [];

    for (const row of stmt.iterate()) {
      const [req, res] = ctx.repository.readTransactionById(row.transaction_id);

      // Custom validation
      if (!res.headers['www-authenticate']) {
        violations.push({
          location: {
            elementType: 'edge',
            elementId: row.transaction_id,
          },
        });
      }
    }

    return violations;
  })
  .done();
```

### Analytics Context API Reference

**Properties:**

- `ctx.repository: HttpTransactionRepository` - Database access
- `ctx.repository.db: Database` - SQLite database instance
- `ctx.format: ThymianFormat` - The specification graph
- `ctx.logger: Logger` - Logging

**Methods:**

- `ctx.validateCommonHttpTransactions(filter, validate?)` - Common interface (with SQL optimization)
- `ctx.validateGroupedCommonHttpTransactions(filter, groupBy, validate)` - Common interface (with SQL optimization)
- `ctx.repository.readTransactionById(id)` - Get full HTTP request/response by ID

**Key Feature: SQL Optimization**

When you use the common interface in analytics context, Thymian automatically compiles your filter expressions to SQL queries for optimal performance:

```typescript
// This filter expression...
ctx.validateCommonHttpTransactions(and(method('POST'), statusCode(201)), not(responseHeader('location')));

// ...is automatically compiled to SQL like:
// SELECT * FROM http_transactions
// WHERE request_method = 'POST' AND response_status = 201
```

---

## Test-Only Rules

### Creating a Test-Only Rule

To create a rule that generates and executes tests:

```typescript
import { method, statusCode, not } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/example-test-only-rule')
  .severity('error')
  .type('test') // Only test context
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section')
  .description('Example test-only rule')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('GET'),
      statusCode(501), // Server should not return 501 for GET
    ),
  )
  .done();
```

### Using Test Context API Directly

For custom test logic, use `overrideTest()`:

```typescript
import { method, statusCode, not, and, or } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule('rfc9110/example-test-advanced')
  .severity('error')
  .type('test')
  .description('Advanced test with custom test case')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(or(method('GET'), method('HEAD')), statusCode(200)), statusCode(501)))
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(or(method('GET'), method('HEAD')), statusCode(200)))
        .run({ checkResponse: false })
        .expectForTransactions(not(statusCode(501)))
        .done(),
    ),
  )
  .done();
```

### Test Context API Reference

**Properties:**

- `ctx.format: ThymianFormat` - The specification graph
- `ctx.logger: Logger` - Logging

**Methods:**

- `ctx.validateCommonHttpTransactions(filter, validate?)` - Common interface (generates tests automatically)
- `ctx.validateGroupedCommonHttpTransactions(filter, groupBy, validate)` - Common interface (generates grouped tests)
- `ctx.httpTest(pipeline)` - Custom test pipeline using `@thymian/http-testing`
- `ctx.assertTransaction(transactionId, fn)` - Assert within a specific transaction
- `ctx.reportViolation(violation)` - Manually report a violation

**Test Case Builder API:**

```typescript
singleTestCase()
  .forTransactionsWith(filter)  // Which transactions to test
  .run(options?)                // Execute (options: { checkResponse?: boolean })
  .expectForTransactions(filter) // Expected outcome
  .done()
```

---

## Hybrid Rules

Hybrid rules work across multiple contexts. This is the most common and powerful pattern.

### Using the Common Interface (Automatic Hybrid)

The simplest way to create a hybrid rule is to use `.rule()` with the common interface and specify multiple types:

```typescript
import { method, hasRequestBody } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static', 'analytics') // Works in both contexts
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(method('TRACE'), hasRequestBody()))
  .done();
```

**How it works:**

1. You write the validation logic once using the common interface
2. Thymian automatically adapts it to each specified context
3. In static context: analyzes spec transactions
4. In analytics context: queries database and validates real transactions

### Three-Way Hybrid (Static + Analytics + Test)

```typescript
import { and, method, statusCode, not, or } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/put-request-must-return-correct-status')
  .severity('error')
  .type('static', 'analytics', 'test') // All three contexts
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description('Origin server MUST send 200, 201, or 204 for successful PUT')
  .appliesTo('origin server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(method('PUT'), statusCodeRange(200, 299)), not(or(statusCode(200), statusCode(201), statusCode(204)))))
  .done();
```

**Behavior in each context:**

- **Static**: Validates all PUT transactions defined in the spec
- **Analytics**: Queries database for PUT requests with 2xx responses
- **Test**: Generates PUT tests and verifies response status codes

### Grouped Transaction Validation (Advanced Hybrid)

For rules that need to compare multiple transactions:

```typescript
import { equalsIgnoreCase } from '@thymian/core';
import { and, method, or, statusCode, url } from '@thymian/core';
import { httpRule, type RuleViolation } from '@thymian/http-linter';
import { arrayDifference, createList } from '../../../../utils.js';

export default httpRule('rfc9110/server-should-send-same-headers-for-head-and-get')
  .severity('warn')
  .type('static', 'analytics', 'test') // Hybrid across all contexts
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description('Server SHOULD send same header fields for HEAD as for GET')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      // Filter: which transactions to include
      and(statusCode(200), or(method('GET'), method('HEAD'))),
      // Group by: how to group transactions (same URL)
      url(),
      // Validate: compare transactions within each group
      (_, transactions) => {
        const getTransaction = transactions.find(([req]) => equalsIgnoreCase(req.method, 'get'));
        const headTransaction = transactions.find(([req]) => equalsIgnoreCase(req.method, 'head'));

        if (!getTransaction || !headTransaction) {
          return undefined; // Need both to compare
        }

        const difference = arrayDifference(getTransaction[1].headers, headTransaction[1].headers);

        if (difference.length === 0) {
          return undefined; // No violation
        }

        return {
          location: {
            elementId: headTransaction[1].id,
            elementType: 'node',
          },
          message: `HEAD response missing headers: ${createList(difference)}`,
        } satisfies RuleViolation;
      },
    ),
  )
  .done();
```

**How grouped validation works:**

1. Filter transactions (e.g., GET and HEAD with 200 status)
2. Group them by a key (e.g., URL)
3. Validate each group (e.g., compare GET vs HEAD headers)
4. Return violations with custom messages

---

## Context-Specific Overrides

Sometimes you need different logic for different contexts, even within a hybrid rule. Use context-specific override methods:

### Overriding One Context in a Hybrid Rule

```typescript
import { type JSONSchemaType } from '@thymian/core';
import { statusCode, not, responseHeader, method, and, authorization } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

type Options = {
  checkAllSecured?: boolean;
};

const optionSchema: JSONSchemaType<Options> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    checkAllSecured: {
      nullable: true,
      type: 'boolean',
      default: false,
    },
  },
};

export default httpRule('rfc9110/server-must-send-www-authenticate-for-401')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .options<Options>(optionSchema)
  .description('Server generating 401 MUST send WWW-Authenticate header')
  .appliesTo('server')
  // Common logic for static and analytics
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  // Custom test logic
  .overrideTest((testContext, options) =>
    testContext.httpTest(
      singleTestCase()
        .forTransactionsWith(and(not(method('HEAD')), or(and(authorization(), constant(options.checkAllSecured)), responseWith(statusCode(401)))))
        .run()
        .expectForTransactions(responseHeader('www-authenticate'))
        .done(),
    ),
  )
  .done();
```

**Why override?**

- The common logic works for static and analytics (check 401 responses have header)
- But for tests, we need custom logic to generate appropriate test requests
- Test context uses rule options to control which endpoints to test

### Overriding All Contexts

You can override each context individually:

```typescript
export default httpRule('rfc9110/complex-rule-with-all-overrides')
  .severity('error')
  .type('static', 'analytics', 'test')
  .description('Complex rule with context-specific logic')
  .appliesTo('server')
  .overrideStaticRule((ctx) => {
    // Custom static validation
    // Access to full ThymianFormat graph
    return validateStatically(ctx.format);
  })
  .overrideAnalyticsRule((ctx) => {
    // Custom analytics validation
    // Access to SQLite database
    return validateWithDatabase(ctx.repository.db);
  })
  .overrideTest((ctx) => {
    // Custom test generation
    // Access to test pipeline
    return ctx.httpTest(customTestPipeline());
  })
  .done();
```

**When to override all contexts:**

- When common interface is insufficient for all contexts
- When each context needs fundamentally different logic
- When you need maximum control and performance

### Override Methods Reference

```typescript
.rule((ctx) => { ... })                    // Common interface (auto-translates)
.overrideStaticRule((ctx) => { ... })      // StaticApiContext
.overrideAnalyticsRule((ctx) => { ... })   // AnalyticsApiContext
.overrideTest((ctx, options?) => { ... })  // HttpTestApiContext
```

**Method signatures:**

```typescript
// Common interface
rule(fn: (ctx: ApiContext) => RuleFnResult | Promise<RuleFnResult>)

// Static override
overrideStaticRule(fn: (ctx: StaticApiContext) => RuleFnResult)

// Analytics override
overrideAnalyticsRule(fn: (ctx: AnalyticsApiContext) => RuleFnResult | Promise<RuleFnResult>)

// Test override
overrideTest(fn: (ctx: HttpTestApiContext, options?: Options) => Promise<RuleFnResult>)
```

---

## Best Practices

### 1. Choose the Right Context(s)

**Use Static when:**

- Rule can be validated from specification alone
- No runtime behavior is required
- Fast feedback during API design is valuable

**Use Analytics when:**

- Need to analyze actual HTTP traffic
- Validating real server behavior
- Checking complex interactions between requests/responses

**Use Test when:**

- Need to actively probe server endpoints
- Testing server capabilities
- Discovering issues through testing

**Use Hybrid when:**

- Rule can be validated in multiple ways
- Want comprehensive coverage
- Logic is similar across contexts

### 2. Prefer the Common Interface

Start with the common interface (`.rule()`) whenever possible:

**Advantages:**

- Write once, run everywhere
- Automatic optimization per context
- Easier to maintain
- Less code duplication

**Example:**

```typescript
// ✅ Good: Uses common interface
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    method('TRACE'),
    hasRequestBody()
  )
)

// ❌ Avoid: Duplicating logic across contexts
.overrideStaticRule((ctx) => validateTrace(ctx))
.overrideAnalyticsRule((ctx) => validateTrace(ctx))
.overrideTest((ctx) => validateTrace(ctx))
```

### 3. Override Only When Necessary

Only use context-specific overrides when:

- Common interface is insufficient
- Need access to full request/response data
- Need context-specific optimizations
- Using rule options in test context

### 4. Access Full Data Patterns

When using common interface but need full data:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    responseHeader('www-authenticate'),
    (req, res) => {
      // Access full node from format
      const fullResponse = ctx.format.getNode<ThymianHttpResponse>(res.id);
      if (!fullResponse) return false;

      // Now validate with full data
      const headerValue = fullResponse.headers['www-authenticate'];
      return customValidation(headerValue);
    }
  )
)
```

This pattern works in all contexts!

### 5. Validation Function Return Types

**In `validateCommonHttpTransactions`:**

```typescript
(req, res, transactionId) => boolean | PartialBy<RuleViolation, 'location'>;
```

- Return `true` → violation detected (uses default location)
- Return `false` → no violation
- Return `{ message: '...' }` → violation with custom message

**In `validateGroupedCommonHttpTransactions`:**

```typescript
(groupKey, transactions) => RuleViolation | undefined;
```

- Return `RuleViolation` → violation detected
- Return `undefined` → no violation
- Must include `location` in the violation object

### 6. Performance Considerations

**Static context:**

- Very fast (in-memory graph)
- Can iterate all transactions efficiently

**Analytics context:**

- Use common interface for SQL optimization
- Avoid retrieving full transactions unless needed
- Let filters do the heavy lifting

**Test context:**

- Slowest (network calls)
- Be selective about which transactions to test
- Use filters to limit test scope

### 7. Error Handling

Always validate that nodes exist before using them:

```typescript
const fullResponse = ctx.format.getNode<ThymianHttpResponse>(res.id);
if (!fullResponse) return false; // or throw error
```

### 8. Leverage Utility Functions

Use existing utilities for common tasks:

```typescript
import { equalsIgnoreCase } from '@thymian/core';
import { arrayDifference, createList } from '../../../../utils.js';

// Case-insensitive comparison
if (equalsIgnoreCase(req.method, 'get')) { ... }

// Array comparison
const missing = arrayDifference(expected, actual);

// Format lists for messages
const message = `Missing: ${createList(missing)}`;
```

### 9. Rule Options

Use options for configurable rules:

```typescript
type Options = {
  maxHeaderSize?: number;
};

const schema: JSONSchemaType<Options> = {
  type: 'object',
  properties: {
    maxHeaderSize: { type: 'number', nullable: true, default: 8192 },
  },
};

export default httpRule('...')
  .options<Options>(schema)
  .overrideTest((ctx, options) => {
    // Use options.maxHeaderSize in validation
  })
  .done();
```

### 10. Grouped Validation Patterns

When comparing transactions, always check for existence:

```typescript
ctx.validateGroupedCommonHttpTransactions(filter, url(), (_, transactions) => {
  const first = transactions.find(condition1);
  const second = transactions.find(condition2);

  // Always check before comparing
  if (!first || !second) {
    return undefined;
  }

  // Now safe to compare
  return compareTransactions(first, second);
});
```

---

## Complete Examples

### Example 1: Simple Static-Only Rule

Validates that TRACE requests don't have bodies (can be checked from spec):

```typescript
import { method, hasRequestBody } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(method('TRACE'), hasRequestBody()))
  .done();
```

**Why static-only?**

- Can be validated from specification alone
- No runtime behavior required
- Fast feedback during API design

---

### Example 2: Simple Analytics-Only Rule

Validates that 401 responses include WWW-Authenticate header (needs real responses):

```typescript
import { statusCode, not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-send-www-authenticate-for-401')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .description('Server generating 401 MUST send WWW-Authenticate header')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  .done();
```

**Why analytics-only?**

- Needs actual 401 responses from real traffic
- Cannot be validated from spec (spec might define it, but we need to verify compliance)
- Not suitable for active testing (would need to trigger auth failures)

---

### Example 3: Test-Only Rule

Tests that servers support GET and HEAD methods:

```typescript
import { and, method, not, or, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule('rfc9110/general-purpose-severs-must-support-get-and-head')
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('All general-purpose servers MUST support GET and HEAD methods')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(or(method('GET'), method('HEAD')), statusCode(200)), statusCode(501)))
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(or(method('GET'), method('HEAD')), statusCode(200)))
        .run({ checkResponse: false })
        .expectForTransactions(not(statusCode(501)))
        .done(),
    ),
  )
  .done();
```

**Why test-only?**

- Needs to actively probe server capabilities
- Cannot determine from spec (spec might not define endpoints)
- Cannot determine from passive traffic (might not have seen 501 errors)

---

### Example 4: Simple Hybrid Rule (Static + Analytics)

Validates PUT request status codes using common interface:

```typescript
import { and, method, statusCode, not, or, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-server-must-send-correct-status-for-put')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .summary('Origin server MUST send 200, 201, or 204 for successful PUT')
  .description('If the target resource does not have a current representation and the PUT successfully creates one, then the origin server MUST inform the user agent by sending a 201 (Created) response. If the target resource does have a current representation and that representation is successfully modified in accordance with the state of the enclosed representation, then the origin server MUST send either a 200 (OK) or a 204 (No Content) response to indicate successful completion of the request.')
  .appliesTo('origin server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(method('PUT'), statusCodeRange(200, 299)), not(or(statusCode(200), statusCode(201), statusCode(204)))))
  .done();
```

**Why hybrid?**

- Works in static: validates spec definitions
- Works in analytics: validates real responses
- Common logic works for both contexts
- No context-specific code needed

---

### Example 5: Three-Way Hybrid (Static + Analytics + Test)

Validates that HEAD responses match GET responses:

```typescript
import { equalsIgnoreCase } from '@thymian/core';
import { and, method, or, statusCode, url } from '@thymian/core';
import { httpRule, type RuleViolation } from '@thymian/http-linter';
import { arrayDifference, createList } from '../../../../utils.js';

export default httpRule('rfc9110/server-should-send-same-headers-for-head')
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description('Server SHOULD send same header fields for HEAD as for GET')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(and(statusCode(200), or(method('GET'), method('HEAD'))), url(), (_, transactions) => {
      const getTransaction = transactions.find(([req]) => equalsIgnoreCase(req.method, 'get'));
      const headTransaction = transactions.find(([req]) => equalsIgnoreCase(req.method, 'head'));

      if (!getTransaction || !headTransaction) {
        return undefined;
      }

      const difference = arrayDifference(getTransaction[1].headers, headTransaction[1].headers);

      if (difference.length === 0) {
        return undefined;
      }

      return {
        location: {
          elementId: headTransaction[1].id,
          elementType: 'node',
        },
        message: `HEAD response missing headers: ${createList(difference)}`,
      } satisfies RuleViolation;
    }),
  )
  .done();
```

**Why three-way hybrid?**

- Works in static: compares spec-defined responses
- Works in analytics: compares real responses from traffic
- Works in test: generates both GET and HEAD requests and compares
- Same validation logic works everywhere

---

### Example 6: Hybrid with Context-Specific Override

Rule with common logic but custom test behavior:

```typescript
import { type JSONSchemaType } from '@thymian/core';
import { and, authorization, constant, method, not, or, responseHeader, responseWith, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

type Options = {
  checkAllSecured?: boolean;
};

const optionSchema: JSONSchemaType<Options> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    checkAllSecured: {
      nullable: true,
      type: 'boolean',
      default: false,
    },
  },
};

export default httpRule('rfc9110/server-must-send-www-authenticate-for-401')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .options<Options>(optionSchema)
  .description('Server generating 401 MUST send WWW-Authenticate header')
  .appliesTo('server')
  // Common logic: static and analytics just check 401 responses
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  // Custom test logic: needs to decide which endpoints to test
  .overrideTest((testContext, options) =>
    testContext.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(
            not(method('HEAD')),
            or(
              // If checkAllSecured, test all secured endpoints
              and(authorization(), constant(options.checkAllSecured)),
              // Otherwise, only test endpoints that returned 401
              responseWith(statusCode(401)),
            ),
          ),
        )
        .run()
        .expectForTransactions(responseHeader('www-authenticate'))
        .done(),
    ),
  )
  .done();
```

**Why override test?**

- Static and analytics can use simple common logic
- Test needs more sophisticated logic to decide what to test
- Uses rule options to control test behavior
- Avoids unnecessarily testing all endpoints

---

### Example 7: Complex Authentication Rule with Custom Validation

Validates that authentication parameter names are unique per challenge:

```typescript
import { or, responseHeader, type ThymianHttpResponse } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { parseChallenges } from '../utils/auth-parser.js';

export default httpRule('rfc9110/auth-parameter-name-must-occur-once-per-challenge')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters')
  .description('Authentication parameter names MUST only occur once per challenge')
  .appliesTo('server', 'proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(or(responseHeader('www-authenticate'), responseHeader('proxy-authenticate')), (req, res) => {
      // Access full response to get header values
      const fullResponse = ctx.format.getNode<ThymianHttpResponse>(res.id);
      if (!fullResponse) return false;

      const wwwAuth = fullResponse.headers['www-authenticate'];
      const proxyAuth = fullResponse.headers['proxy-authenticate'];

      // Collect all header values (can be arrays)
      const headers = [...(Array.isArray(wwwAuth) ? wwwAuth : wwwAuth ? [wwwAuth] : []), ...(Array.isArray(proxyAuth) ? proxyAuth : proxyAuth ? [proxyAuth] : [])];

      // Parse and validate each header
      for (const headerValue of headers) {
        const challenges = parseChallenges(headerValue);

        for (const challenge of challenges) {
          const seenParams = new Set<string>();

          for (const param of challenge.parameters) {
            const lowerName = param.name.toLowerCase();

            if (seenParams.has(lowerName)) {
              return true; // Duplicate found - violation!
            }

            seenParams.add(lowerName);
          }
        }
      }

      return false; // No duplicates
    }),
  )
  .done();
```

**Key patterns demonstrated:**

- Using common interface with custom validation function
- Accessing full response data via `ctx.format.getNode()`
- Handling both single and array header values
- Using external parser utilities
- Case-insensitive parameter matching
- Complex validation logic that still works in multiple contexts

---

### Example 8: Analytics-Only with Custom SQL

Advanced analytics rule using custom SQL query:

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/check-auth-flow-sequence')
  .severity('warn')
  .type('analytics')
  .description('Validates authentication flow sequence in recorded traffic')
  .appliesTo('server')
  .overrideAnalyticsRule((ctx) => {
    const db = ctx.repository.db;

    // Custom SQL to find auth sequences
    const query = `
      SELECT
        t1.id as first_id,
        t2.id as second_id
      FROM http_transactions t1
      JOIN http_transactions t2
        ON t1.request_url = t2.request_url
        AND t2.timestamp > t1.timestamp
      WHERE t1.response_status = 401
        AND t2.response_status = 200
        AND t2.request_headers LIKE '%Authorization%'
      ORDER BY t1.timestamp
    `;

    const stmt = db.prepare(query);
    const violations = [];

    for (const row of stmt.iterate()) {
      const [req1, res1] = ctx.repository.readTransactionById(row.first_id);
      const [req2, res2] = ctx.repository.readTransactionById(row.second_id);

      // Validate the auth flow
      if (!validateAuthFlow(req1, res1, req2, res2)) {
        violations.push({
          location: {
            elementType: 'edge',
            elementId: row.second_id,
          },
          message: 'Invalid authentication flow sequence',
        });
      }
    }

    return violations;
  })
  .done();

function validateAuthFlow(req1, res1, req2, res2): boolean {
  // Custom validation logic
  return true;
}
```

**Why custom SQL?**

- Need to correlate multiple transactions
- Complex queries beyond simple filters
- Performance optimization for large datasets
- Specific to analytics context (cannot work in static/test)

---

## Summary

### Quick Reference: Choosing Contexts

| Validation Need         | Static | Analytics | Test | Common Interface |
| ----------------------- | ------ | --------- | ---- | ---------------- |
| Check spec definitions  | ✅     | ❌        | ❌   | ✅               |
| Analyze real traffic    | ❌     | ✅        | ❌   | ✅               |
| Active endpoint testing | ❌     | ❌        | ✅   | ✅               |
| Parse header values     | ✅\*   | ✅\*      | ✅\* | ✅\*             |
| Access JSON schemas     | ✅     | ❌        | ❌   | ❌               |
| Custom SQL queries      | ❌     | ✅        | ❌   | ❌               |
| Custom test generation  | ❌     | ❌        | ✅   | ❌               |

_\* Use `ctx.format.getNode()` to access full data within common interface_

### When to Use What

**Use `.rule()` (common interface) when:**

- ✅ Validation can work with simplified transaction model
- ✅ Want rule to work in multiple contexts
- ✅ Only need header presence, methods, status codes
- ✅ Want automatic optimization per context

**Use `overrideStaticRule()` when:**

- ✅ Need access to JSON schemas
- ✅ Need to traverse specification graph
- ✅ Static-specific optimization needed

**Use `overrideAnalyticsRule()` when:**

- ✅ Need custom SQL queries
- ✅ Complex transaction correlation
- ✅ Analytics-specific optimization needed

**Use `overrideTest()` when:**

- ✅ Need custom test generation logic
- ✅ Using rule options
- ✅ Complex test scenarios

### Key Takeaways

1. **Start with the common interface** - it's the most flexible and maintainable approach
2. **Use hybrid rules** whenever possible for maximum coverage
3. **Override only when necessary** - when common interface is insufficient
4. **Access full data via `ctx.format.getNode()`** when using common interface
5. **Validate grouped transactions** for comparing multiple requests/responses
6. **Use context-specific overrides** for optimization or special logic
7. **Leverage rule options** for configurable behavior
8. **Always check for null** when accessing nodes

---

_Last Updated: 2025-01-01_
_For more information, see [CREATING_NEW_RULES.md](./CREATING_NEW_RULES.md)_
