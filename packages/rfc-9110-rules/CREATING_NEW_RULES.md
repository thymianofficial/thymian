# Creating New Rules for RFC 9110

## Document Purpose

This document provides comprehensive guidance for creating new HTTP linting rules based on [RFC 9110 - HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110). It is structured for both human developers and Large Language Models (LLMs) to facilitate rule implementation.

## Table of Contents

1. [Overview](#overview)
2. [Rule Architecture](#rule-architecture)
3. [Step-by-Step Rule Creation](#step-by-step-rule-creation)
4. [API Reference](#api-reference)
5. [Available Filters](#available-filters)
6. [Rule Types and Severities](#rule-types-and-severities)
7. [Testing Patterns](#testing-patterns)
8. [File Organization](#file-organization)
9. [RFC 9110 Structure Reference](#rfc-9110-structure-reference)
10. [Best Practices](#best-practices)
11. [Complete Examples](#complete-examples)
12. [Advanced Patterns](#advanced-patterns)

---

## Overview

### What is a Rule?

A rule in the Thymian HTTP linter validates the Thymian format, HTTP APIs and HTTP transactions against some predefined set of rules. In this project every rule is extracted from RFC9110. Each rule:

- Targets a specific requirement from RFC 9110
- Validates HTTP requests, responses, or both
- Can run in multiple modes: static, analytics, or test
- Provides actionable feedback when violations are detected

### Rule Location

All RFC 9110 rules are located in:

```
/packages/rfc-9110-rules/src/rules/
```

### Rule Discovery

Rules are automatically discovered using a glob pattern defined in `src/index.ts`:

```typescript
const rfc9110: RuleSet = {
  name: 'rfc9110',
  url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
  pattern: 'rules/**/*.rule.js',
};
```

All files ending with `.rule.ts` in the `rules/` directory are automatically loaded.

---

## Rule Architecture

### Core Components

1. **Rule Builder** (`httpRule`): Fluent API for defining rules
2. **Filters**: Declarative predicates for matching HTTP transactions
3. **Validation Logic**: The actual rule implementation
4. **Metadata**: Description, severity, type, and RFC references

### Basic Rule Structure

```typescript
import { method, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/rule-identifier')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-reference')
  .description('Description of what the rule validates')
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      // Filter for transactions to check
      method('GET'),
      // Filter for violations
      statusCode(500),
    ),
  )
  .done();
```

---

## Step-by-Step Rule Creation

### Step 1: Identify the RFC Requirement

1. Read the relevant section in RFC 9110
2. Identify the normative language (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY)
3. Determine what HTTP participant the rule applies to (client, server, proxy, origin server)
4. Note the specific HTTP elements involved (methods, headers, status codes)

### Step 2: Create the Rule File

**File Naming Convention:**

- Use kebab-case
- the rule name starts with the role(s) that the rule can be applied to, followed by the requirement keyword (MUST, SHOULD, etc.) and then a description of the rule
- End with `.rule.ts`
- Example: `client-must-not-send-content-in-trace-request.rule.ts`

**File Location:**
Organize by RFC section hierarchy:

```
rules/
├── methods/
│   ├── method-definitions/
│   │   ├── get/
│   │   ├── post/
│   │   ├── put/
│   │   └── trace/
│   └── method-properties/
├── status-codes/
│   ├── informational-1xx/
│   ├── successful-2xx/
│   ├── redirection-3xx/
│   ├── client-error-4xx/
│   └── server-error-5xx/
└── headers/
```

### Step 3: Define Rule Metadata

```typescript
export default httpRule('rfc9110/unique-rule-identifier')
  .severity('error') // or 'warn'
  .type('static', 'analytics', 'test', 'informational') // one or more types
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-section')
  .description('Full description from RFC 9110')
  .summary('Optional shorter summary') // optional
  .appliesTo('client'); // who must comply
```

**Rule Identifier Convention:**

- Format: `rfc9110/descriptive-name`
- Must be unique across all rules
- Use kebab-case
- Be specific and descriptive

### Step 4: Implement the Rule Logic

**Basic Validation Pattern:**

```typescript
.
rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    filterForTransactionsToCheck,
    filterForViolations
  )
)
```

The validation works by:

1. First filter: Selects which transactions to validate
2. Second filter: Identifies violations within those transactions
3. Any transaction matching both filters is reported as a violation

### Step 5: Add Custom Tests (Optional)

For rules that need specific test behavior:

```typescript
.
overrideTest((ctx) =>
  ctx.httpTest(
    singleTestCase()
      .forTransactionsWith(filterForSetup)
      .run({ checkResponse: false })
      .expectForTransactions(filterForExpectation)
      .done()
  )
)
```
### Step 6: Add Custom static checks (Optional)

Just like the optional custom tests, the static checks can be overridden. When using the specific StaticApiContext, the rule has full access to the `ThymianFormat` instance. This allows for example to run checks on the JSON Schemas of the transactions.
### Step 7: Add custom analytics checks (optional)

Also the AnalyticsContext provides its own interface with which more specific tests can be defined. One gets full access to the underlying SQLite database and can run any SQL statement.

### Step 8: Complete the Rule

Always end with `.done()`:

```typescript
.
done();
```

---

## API Reference

### Rule Builder Methods

#### `httpRule(name: string)`

Creates a new rule builder.

**Parameters:**

- `name`: Unique identifier in format `rfc9110/rule-name`

**Returns:** Rule builder instance

---

#### `.severity(level: 'error' | 'warn'  | 'hint')`

Sets the rule severity.

**Guidelines:**

- `'error'`: For MUST/MUST NOT requirements (mandatory)
- `'warn'`: For SHOULD/SHOULD NOT requirements (recommended)

**Required:** Yes

---

#### `.type(...types: ('static' | 'analytics' | 'test' | 'informational')[])`

Specifies when the rule runs.

**Types:**

- `'static'`: Analyzes OpenAPI specifications
- `'analytics'`: Analyzes recorded HTTP transactions
- `'test'`: Generates and executes HTTP tests
- `'informational'`: Documentation-only rule (no validation logic executed)

**Can specify multiple types.**

**Note:** Rules with only `'informational'` type do not require a `.rule()` method.

**Required:** Yes

---

#### `.url(url: string)`

Links to the relevant RFC 9110 section.

**Format:** `https://www.rfc-editor.org/rfc/rfc9110.html#name-section-name`

**Required:** Recommended

---

#### `.description(text: string)`

Full description of what the rule validates.

**Guidelines:**

- Use the exact text from RFC 9110 when possible
- Should be clear and complete
- Explain the requirement fully

**Required:** Yes

---

#### `.summary(text: string)`

Optional shorter summary.

**Use when:** Description is long and a brief summary would help

**Required:** No

---

#### `.appliesTo(...participants: string[])`

Specifies which HTTP participant(s) must comply. Can accept one or more participants.

**Common values:**

- `'client'`
- `'server'`
- `'origin server'`
- `'proxy'`
- `'cache'`

**Examples:**

```typescript
// Single participant
.appliesTo('client')

// Multiple participants
.appliesTo('server', 'proxy')
```

**Required:** Recommended

---

#### `.rule(fn: (ctx) => void)`

Implements the main validation logic. There are three validation patterns available:

**Pattern A: Two Filters (Transaction + Violation)**

Use when you need to select transactions first, then check for violations within them:

```typescript
.
rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    transactionFilter,  // Which transactions to check
    violationFilter     // What counts as a violation
  )
)
```

Example: Check TRACE requests (transaction) for request body (violation)

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    method('TRACE'),
    hasRequestBody()
  )
)
```

**Pattern B: Single Filter (Direct Violation)**

Use when the filter itself identifies the violation:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    violationFilter  // Matching this filter IS the violation
  )
)
```

Example: Any GET request with a body is a violation

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    and(method('GET'), hasRequestBody())
  )
)
```

**Pattern C: Custom Validation Function**

Use for complex validation logic that requires examining request/response details:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    transactionFilter,  // Which transactions to check
    (request, response) => {
      // Custom validation logic
      // Return true if violation detected, false otherwise
      return /* boolean */;
    }
  )
)
```

Example: Complex authentication header validation

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    responseHeader('www-authenticate'),
    (request, response) => {
      const authHeader = getHeaderValue(response.headers, 'www-authenticate');
      const parsed = parseAuthenticationHeader(authHeader);
      return hasDuplicateParameters(parsed);
    }
  )
)
```

**Pattern D: Grouped Transaction Validation**

Use when you need to compare or validate groups of related transactions (e.g., comparing GET and HEAD responses to the same URL):

```typescript
.rule((ctx) =>
  ctx.validateGroupedCommonHttpTransactions(
    transactionFilter,  // Which transactions to include
    groupingFilter,     // How to group transactions (e.g., by url())
    (groupKey, transactions) => {
      // Custom validation logic comparing transactions in the group
      // Return RuleViolation object if violation detected, undefined otherwise
      if (violationDetected) {
        return {
          location: {
            elementId: transaction[1].id,
            elementType: 'node',
          },
          message: 'Violation description'
        } satisfies RuleViolation;
      }
      return undefined;
    }
  )
)
```

Example: Comparing HEAD and GET responses

```typescript
import { equalsIgnoreCase } from '@thymian/core';
import { type RuleViolation } from '@thymian/http-linter';

.rule((ctx) =>
  ctx.validateGroupedCommonHttpTransactions(
    and(statusCode(200), or(method('GET'), method('HEAD'))),
    url(),  // Group by URL
    (_, transactions) => {
      const getTransaction = transactions.find(([req]) =>
        equalsIgnoreCase(req.method, 'get')
      );
      const headTransaction = transactions.find(([req]) =>
        equalsIgnoreCase(req.method, 'head')
      );

      if (!getTransaction || !headTransaction) {
        return undefined;
      }

      // Compare and return violation if needed
      if (/* difference found */) {
        return {
          location: { elementId: headTransaction[1].id, elementType: 'node' },
          message: 'HEAD response differs from GET'
        } satisfies RuleViolation;
      }
      return undefined;
    }
  )
)
```

**Required:** Yes (unless rule type is `'informational'`)

---

#### `.overrideTest(fn: (ctx, options?) => void)`

Provides custom test implementation.

**Use when:** Default test generation doesn't fit the rule's needs

**Required:** No

---

#### `.overrideAnalyticsRule(fn: (ctx, options?) => void)`

Provides custom analytics implementation.

**Required:** No

---

#### `.overrideStaticRule(fn: (ctx, options?) => void)`

Provides custom static analysis implementation.

**Required:** No

---

#### `.tags(tags: string[])`

Adds tags for categorization.

**Required:** No

---

#### `.explanation(text: string)`

Provides additional explanation or rationale.

**Required:** No

---

#### `.options<T>(schema: JSONSchemaType<T>)`

Defines configurable options for the rule using JSON Schema. Options can be used in rule logic and test/analytics overrides.

**Example:**

```typescript
import { type JSONSchemaType } from '@thymian/core';

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

export default httpRule('rfc9110/example-with-options')
  .options<Options>(optionSchema)
  .overrideTest((testContext, options) => {
    // Use options.checkAllSecured here
    testContext.httpTest(/* ... */);
  })
  .done();
```

**See also:** `status-codes/client-error-4xx/401/server-must-send-www-authenticate-header-for-401-response.rule.ts` for a complete real-world example.

**Required:** No

---

#### `.done()`

Finalizes and returns the rule.

**Required:** Yes (must be the last method called)

---

## Available Filters

Filters are imported from `@thymian/core` and used to match HTTP transactions.

### Request Filters

#### `method(methodName: string)`

Matches requests with specific HTTP method.

```typescript
method('GET');
method('POST');
method('TRACE');
```

#### `methods(...methodNames: string[])`

Matches requests with any of the specified methods.

```typescript
methods('GET', 'HEAD');
```

#### `requestHeader(headerName: string, value?: string)`

Matches requests containing a specific header.

```typescript
requestHeader('content-type');
requestHeader('content-type', 'application/json');
```

#### `hasRequestBody(hasBody: boolean = true)`

Matches requests with or without a body.

```typescript
hasRequestBody(); // Has body
hasRequestBody(false); // No body
```

#### `requestMediaType(mediaType: string)`

Matches requests with specific content type.

```typescript
requestMediaType('application/json');
```

#### `authorization(isAuthorized: boolean = true)`

Matches requests based on authorization presence.

```typescript
authorization(); // Is authorized
authorization(false); // Not authorized
```

---

### Response Filters

#### `statusCode(code: number)`

Matches responses with specific status code.

```typescript
statusCode(200);
statusCode(404);
statusCode(501);
```

#### `statusCodeRange(start: number, end: number)`

Matches responses within status code range (inclusive).

```typescript
statusCodeRange(200, 299); // All 2xx
statusCodeRange(400, 499); // All 4xx
```

#### `successfulStatusCode()`

Matches responses with 2xx status codes.

```typescript
successfulStatusCode();
```

#### `responseHeader(headerName: string, value?: string)`

Matches responses containing a specific header.

```typescript
responseHeader('location');
responseHeader('content-type', 'text/html');
```

#### `responseTrailer(trailerName: string, value?: string)`

Matches responses containing a specific trailer.

```typescript
responseTrailer('checksum');
```

#### `hasResponseBody(hasBody: boolean = true)`

Matches responses with or without a body.

```typescript
hasResponseBody(); // Has body
hasResponseBody(false); // No body
```

#### `responseMediaType(mediaType: string)`

Matches responses with specific content type.

```typescript
responseMediaType('application/json');
```

---

### Request/Response Filters

#### `path(pathPattern: string)`

Matches transactions with specific URL path.

```typescript
path('/api/users');
```

#### `url(urlPattern: string)`

Matches transactions with specific URL.

```typescript
url('https://example.com/api');
```

#### `origin(originUrl: string)`

Matches transactions with specific origin.

```typescript
origin('https://example.com');
```

#### `port(portNumber: number)`

Matches transactions on specific port.

```typescript
port(443);
port(8080);
```

#### `queryParameter(name: string, value?: string)`

Matches transactions with specific query parameter.

```typescript
queryParameter('page');
queryParameter('page', '1');
```

---

### Logical Operators

#### `and(...filters: Filter[])`

Matches when ALL filters match.

```typescript
and(method('POST'), statusCode(201));
```

#### `or(...filters: Filter[])`

Matches when ANY filter matches.

```typescript
or(method('GET'), method('HEAD'));
```

#### `not(filter: Filter)`

Inverts filter (matches when filter does NOT match).

```typescript
not(statusCode(200));
not(requestHeader('authorization'));
```

#### `xor(...filters: Filter[])`

Matches when exactly ONE filter matches.

```typescript
xor(requestHeader('if-match'), requestHeader('if-unmodified-since'));
```

---

### Utility Filters

#### `constant(value: boolean)`

Always returns the specified value.

```typescript
constant(true); // Always matches
constant(false); // Never matches
```

#### `responseWith(filter: Filter)`

Evaluates filter in response context.

```typescript
responseWith(statusCode(200));
```

---

### Utility Functions

These helper functions are available for use in custom validation logic:

#### `equalsIgnoreCase(str1: string, str2: string)`

**Import from:** `@thymian/core`

Performs case-insensitive string comparison.

```typescript
import { equalsIgnoreCase } from '@thymian/core';

if (equalsIgnoreCase(req.method, 'get')) {
  // Handle GET request
}
```

**Use in:** Pattern D validation functions for comparing HTTP methods, header names, etc.

#### `arrayDifference(array1: string[][], array2: string[][])`

**Import from:** `'../../../../utils.js'` (relative path from rule file)

Finds elements present in the first array but not in the second.

```typescript
import { arrayDifference } from '../../../../utils.js';

const missingHeaders = arrayDifference(expectedTransaction.headers, actualTransaction.headers);
```

**Use in:** Comparing headers between transactions (e.g., GET vs HEAD responses)

#### `createList(items: string[][])`

**Import from:** `'../../../../utils.js'` (relative path from rule file)

Creates a formatted string list from an array of header tuples.

```typescript
import { createList } from '../../../../utils.js';

const headerList = createList(missingHeaders);
// Returns: "header1, header2, header3"
```

**Use in:** Generating violation messages with lists of headers

---

## Rule Types and Severities

### Rule Types

#### Static Analysis (`'static'`)

- Analyzes OpenAPI specification files
- Checks API design before implementation
- No runtime HTTP traffic needed
- Fast validation
- **Supports custom validation functions** for parsing/validating spec details

**Use for:** Rules that can be validated from API specification alone

**Examples:**

- Header syntax validation (e.g., quoted-string format)
- Parameter naming rules
- Schema structure requirements

#### Analytics (`'analytics'`)

- Analyzes recorded HTTP transactions
- Validates actual HTTP traffic
- Can detect runtime-only issues
- Requires transaction data
- **Supports custom validation functions** for examining request/response details

**Use for:** Rules requiring inspection of actual HTTP traffic

**Examples:**

- Status code validation with specific headers
- Authentication flow analysis
- Response content validation

#### Test (`'test'`)

- Generates and executes HTTP tests
- Proactively validates server behavior
- Can discover issues through testing
- Requires running server
- **Supports custom validation functions** and test overrides

**Use for:** Rules that need to actively test HTTP endpoints

**Examples:**

- Server capability testing (GET/HEAD support)
- Proxy forwarding behavior
- Server compliance under specific conditions

**Note:** All three modes support custom validation functions (Pattern C). Complex validation logic works in any mode.

### Severity Levels

#### Error (`'error'`)

Use for **mandatory** requirements:

- MUST
- MUST NOT
- REQUIRED
- SHALL
- SHALL NOT

#### Warning (`'warn'`)

Use for **recommended** requirements:

- SHOULD
- SHOULD NOT
- RECOMMENDED

---

## Testing Patterns

### Basic Test Override

```typescript
.
overrideTest((ctx) =>
  ctx.httpTest(
    singleTestCase()
      .forTransactionsWith(method('GET'))
      .run({ checkResponse: false })
      .expectForTransactions(not(statusCode(501)))
      .done()
  )
)
```

### Test Case Builder Methods

#### `forTransactionsWith(filter: Filter)`

Specifies which transactions to test against.

#### `run(options?: { checkResponse?: boolean })`

Executes the test with options.

#### `expectForTransactions(filter: Filter)`

Defines expected outcomes.

#### `done()`

Completes test case definition.

---

## File Organization

### Directory Structure

Organize rules hierarchically based on RFC 9110 structure:

```
src/rules/
├── methods/
│   ├── general-purpose-severs-must-support-get-and-head.rule.ts
│   ├── method-definitions/
│   │   ├── get/
│   │   │   └── [GET-specific rules]
│   │   ├── post/
│   │   │   └── [POST-specific rules]
│   │   ├── put/
│   │   ├── delete/
│   │   ├── head/
│   │   ├── options/
│   │   ├── trace/
│   │   └── connect/
│   └── method-properties/
│       └── [method property rules]
├── status-codes/
│   ├── informational-1xx/
│   ├── successful-2xx/
│   │   └── 206/
│   ├── redirection-3xx/
│   │   ├── 300/
│   │   ├── 301/
│   │   └── [other 3xx codes]
│   ├── client-error-4xx/
│   │   └── 401/
│   └── server-error-5xx/
└── headers/
    └── [header-related rules]
```


## RFC 9110 Structure Reference

### Main Sections

RFC 9110 is organized into the following major sections:

1. **Introduction** (Section 1)
2. **Conformance** (Section 2)
3. **HTTP Semantics** (Section 3-6)

- Message Abstraction
- Identifiers in HTTP
- Fields
- Message Routing

4. **Methods** (Section 9)

- Common Method Properties
- Method Definitions (GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE)

5. **Status Codes** (Section 15)

- 1xx Informational
- 2xx Successful
- 3xx Redirection
- 4xx Client Error
- 5xx Server Error

6. **Header Fields** (Various sections)
7. **Content Negotiation** (Section 12)
8. **Conditional Requests** (Section 13)
9. **Range Requests** (Section 14)
10. **Caching** (Separate RFC 9111)

### Finding Requirements

**Look for normative language:**

- MUST / MUST NOT / REQUIRED / SHALL / SHALL NOT (mandatory - use `severity('error')`)
- SHOULD / SHOULD NOT / RECOMMENDED (recommended - use `severity('warn')`)
- MAY / OPTIONAL (optional - typically don't create rules)

**URL Format:**

```
https://www.rfc-editor.org/rfc/rfc9110.html#name-section-name
```

**Example:**

```
https://www.rfc-editor.org/rfc/rfc9110.html#name-trace
```

### RFC 9110 Key Sections Quick Reference

| Section | Topic                    | Common Rules                |
| ------- | ------------------------ | --------------------------- |
| 9.1     | Overview of Methods      | General method requirements |
| 9.2     | Common Method Properties | Safe, idempotent, cacheable |
| 9.3.1   | GET                      | GET-specific rules          |
| 9.3.2   | HEAD                     | HEAD-specific rules         |
| 9.3.3   | POST                     | POST-specific rules         |
| 9.3.4   | PUT                      | PUT-specific rules          |
| 9.3.5   | DELETE                   | DELETE-specific rules       |
| 9.3.6   | CONNECT                  | CONNECT-specific rules      |
| 9.3.7   | OPTIONS                  | OPTIONS-specific rules      |
| 9.3.8   | TRACE                    | TRACE-specific rules        |
| 15.2    | 1xx Informational        | 1xx status code rules       |
| 15.3    | 2xx Successful           | 2xx status code rules       |
| 15.4    | 3xx Redirection          | 3xx status code rules       |
| 15.5    | 4xx Client Error         | 4xx status code rules       |
| 15.6    | 5xx Server Error         | 5xx status code rules       |

---

## Best Practices

### 1. Rule Granularity

**Good:** One rule per RFC requirement

```typescript
// ✅ Specific, testable requirement
httpRule('rfc9110/client-must-not-send-content-in-trace-request');
```

**Avoid:** Multiple requirements in one rule

```typescript
// ❌ Too broad, tests multiple things
httpRule('rfc9110/trace-method-requirements');
```

### 2. Clear Descriptions

**Good:** Use RFC text directly

```typescript
.
description('A client MUST NOT send content in a TRACE request.')
```

**Avoid:** Paraphrasing or summarizing

```typescript
// ❌ Less clear
.
description('TRACE requests should not have bodies')
```

### 3. Appropriate Severity

**Error for MUST/MUST NOT:**

```typescript
.
severity('error')
  .description('A client MUST NOT send content in a TRACE request.')
```

**Warning for SHOULD/SHOULD NOT:**

```typescript
.
severity('warn')
  .description('An origin server SHOULD send a Location header field in a 201 response.')
```

### 4. Specific Filters

**Good:** Precise filtering

```typescript
.
rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    and(method('PUT'), statusCodeRange(200, 299)),
    not(or(statusCode(200), statusCode(201), statusCode(204)))
  )
)
```

**Avoid:** Overly broad filtering

```typescript
// ❌ Too general
.
rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    method('PUT'),
    statusCode(400)
  )
)
```

### 5. Proper Type Selection

**Use multiple types when applicable:**

```typescript
.
type('static', 'analytics', 'test')
```

**Use specific type when rule only applies to one:**

```typescript
.
type('analytics')  // Only makes sense for recorded traffic
```

### 6. Complete Metadata

**Always include:**

- Unique identifier
- Severity
- Type(s)
- Description
- URL reference
- appliesTo

```typescript
export default httpRule('rfc9110/complete-metadata-example')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-section')
  .description('Complete description from RFC')
  .appliesTo('client')
  .rule((ctx) => /* ... */)
  .done();
```

### 7. Consistent File Organization

- Place rules in directories matching RFC structure
- Use consistent naming
- One rule per file
- Export as default

### 8. Leverage Existing Patterns

Review existing rules for similar requirements:

```bash
# Find similar rules
find src/rules -name "*.rule.ts" | grep -i "method"
find src/rules -name "*.rule.ts" | grep -i "status"
```


## Complete Examples

### Example 1: Simple Client Rule

```typescript
import { hasRequestBody, method } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(method('TRACE'), hasRequestBody()))
  .done();
```

**Explanation:**

- Checks TRACE requests
- Flags violations when TRACE has a request body
- Simple, single-purpose rule
- Works in static and analytics modes

---

### Example 2: Server Response Validation

```typescript
import { and, method, not, or, statusCode, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-server-must-respond-with-correct-response-code-for-put-request')
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .summary('Origin server MUST sending a 200 (OK), 201 (Created) or 204 (No Content) response, depending on whether a resource was created or updated.')
  .description('If the target resource does not have a current representation and the PUT successfully creates one, then the origin server MUST inform the user agent by sending a 201 (Created) response. If the target resource does have a current representation and that representation is successfully modified in accordance with the state of the enclosed representation, then the origin server MUST send either a 200 (OK) or a 204 (No Content) response to indicate successful completion of the request.')
  .appliesTo('origin server')
  .rule((context) => context.validateCommonHttpTransactions(and(method('PUT'), statusCodeRange(200, 299)), not(or(statusCode(200), statusCode(201), statusCode(204)))))
  .done();
```

**Explanation:**

- Validates PUT responses
- Only checks successful responses (2xx)
- Ensures status code is 200, 201, or 204
- Includes both summary and full description
- Works in all three modes

---

### Example 3: Rule with Custom Test

```typescript
import { and, method, not, or, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule('rfc9110/general-purpose-severs-must-support-get-and-head')
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('All general-purpose servers MUST support the methods GET and HEAD.')
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

**Explanation:**

- Tests that servers support GET and HEAD
- Custom test to actively probe server
- Checks for 501 (Not Implemented) error
- Test-only rule (requires running server)

---

### Example 4: Header Validation

```typescript
import { and, hasRequestBody, method, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-send-content-type-header-for-content-in-options-request')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description('A client that generates an OPTIONS request containing content MUST send a valid Content-Type header field describing the representation media type.')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(method('OPTIONS'), hasRequestBody()), not(requestHeader('content-type'))))
  .done();
```

**Explanation:**

- Validates OPTIONS requests with body
- Ensures Content-Type header is present
- Analytics-only (needs actual transaction data)
- Uses header filter

---

### Example 5: Informational Rule

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-generate-new-max-forwards-header').severity('error').type('informational').url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options').description('A proxy MUST NOT generate a Max-Forwards header field while forwarding a request unless that request was received with a Max-Forwards field.').appliesTo('proxy').done();
```

**Explanation:**

- Documentation-only rule (no validation logic)
- No `.rule()` method required for `'informational'` type
- Captures RFC requirement that cannot be automatically validated
- Serves as reference for developers and documentation
- Common for complex requirements involving proxy behavior or context-dependent rules

---

## Advanced Patterns

This section covers advanced rule implementation patterns used in complex rules, particularly authentication rules.

### Using Custom Validation Functions

When filters alone cannot express the validation logic, use custom functions that receive `request` and `response` objects:

```typescript
import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/complex-validation-example')
  .severity('error')
  .type('static')
  .description('Example of custom validation logic')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('www-authenticate'), // Select transactions
      (request, response) => {
        // Custom logic with access to full request/response
        const authHeader = getHeader(response.headers, 'www-authenticate');
        if (!authHeader) return false;

        const parsed = parseAuthenticationHeader(authHeader);
        return hasDuplicateParameters(parsed);
      },
    ),
  )
  .done();
```

### Multiple Participants

Some rules apply to multiple HTTP participants:

```typescript
export default httpRule('rfc9110/applies-to-multiple')
  .appliesTo('server', 'proxy') // Both must comply
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(or(responseHeader('www-authenticate'), responseHeader('proxy-authenticate')), (request, response) => {
      // Validation logic for both server and proxy
      return checkBothHeaders(response);
    }),
  )
  .done();
```

### When to Use Each Pattern

**Use Filter-Only (Pattern A/B) when:**

- Validation is straightforward (header presence, status code, method)
- No parsing or complex logic required
- Example: "Client MUST NOT send body in TRACE request"

**Use Custom Functions (Pattern C) when:**

- Need to parse header values or body content
- Multiple conditions depend on parsed data
- Complex RFC requirements requiring state inspection
- Example: "Auth parameter names MUST be unique per challenge"

**Use Helper Functions/Utilities when:**

- Same validation logic used in multiple rules
- Complex parsing required (auth headers, media types)
- Want to unit test parsing logic separately

### Real-World Examples

**See these authentication rules for advanced patterns:**

- `authentication/parameters/authentication-parameter-name-must-occur-once-per-challenge.rule.ts` - Custom parsing and validation
- `authentication/realm/realm-parameter-must-use-quoted-string-syntax.rule.ts` - Helper functions for syntax validation
- `authentication/credentials/origin-server-should-send-401-for-invalid-credentials.rule.ts` - Complex conditional logic
- `authentication/utils/auth-parser.ts` - Shared utility functions

---

## Summary Checklist

When creating a new rule, ensure you have:

- [ ] Identified the specific RFC 9110 requirement
- [ ] Created file in correct directory with proper naming
- [ ] Used unique rule identifier in format `rfc9110/rule-name`
- [ ] Set appropriate severity (`'error'` or `'warn'`)
- [ ] Specified correct type(s) (`'static'`, `'analytics'`, `'test'`)
- [ ] Added RFC URL reference
- [ ] Written clear description (preferably from RFC text)
- [ ] Specified `appliesTo` participant(s)
- [ ] Implemented rule logic with appropriate validation pattern
- [ ] Tested the rule works correctly
- [ ] Verified no false positives
- [ ] Called `.done()` at the end

---

## Additional Resources

### Utility Functions

Located in `src/utils.ts`:

```typescript
// Format array as readable list
export function createList(list: string[]): string;

// Find difference between two arrays
export function arrayDifference(as: string[], bs: string[]): string[];
```

### Related Packages

- `@thymian/core`: Core types and filters
- `@thymian/http-linter`: Rule builder and linter
- `@thymian/http-testing`: Test case builders

### External References

- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 2119 - Key words for RFCs](https://www.rfc-editor.org/rfc/rfc2119.html)

---

## LLM-Specific Guidance

### For Code Generation

When generating a new rule:

1. **Parse the requirement**: Extract method, status code, headers, participant(s)
2. **Determine severity**: MUST/MUST NOT → `'error'`, SHOULD/SHOULD NOT → `'warn'`
3. **Select validation pattern**:
   - Simple filter-based? → Pattern A or B
   - Need parsing/complex logic? → Pattern C (custom function)
4. **Build validation**: Use appropriate `validateCommonHttpTransactions` pattern
5. **Complete metadata**: All required fields with proper formatting
6. **End with done()**: Always call `.done()` to finalize

### Common Patterns to Recognize

**Pattern 1: Two-Filter Validation (Transaction + Violation)**

```typescript
method(X) + hasBody → violation
statusCode(X) + not(header(Y)) → violation
```

**Pattern 2: Single-Filter Validation (Direct)**

```typescript
and(method(X), hasBody) → IS violation
```

**Pattern 3: Custom Function Validation**

```typescript
header(X) + (req, res) => parseAndValidate(res.headers) → violation
```

**Pattern 4: Multiple Participants**

```typescript
.appliesTo('server', 'proxy') // Both must comply
```

**Pattern 5: Header requirements**

```typescript
condition + not(header(X)) → violation
```

**Pattern 6: Logical combinations**

```typescript
and(condition1, condition2) + violation_check → violation
```

### Validation Pattern Selection Guide

**Use Pattern A (two filters) when:**

- Need to select specific transactions first
- Then check for violations within them
- Example: "Check TRACE requests for request body"

**Use Pattern B (single filter) when:**

- The filter itself identifies the violation
- No need for separate transaction selection
- Example: "Any GET request with body is a violation"

**Use Pattern C (custom function) when:**

- Need to parse header values or body content
- Complex conditional logic based on parsed data
- Multiple RFC rules combined
- Example: "Auth parameter names must be unique"

### Error Prevention

1. Always import required filters from `@thymian/core`
2. Always import `httpRule` from `@thymian/http-linter`
3. Rule identifier must be unique and in format `rfc9110/name`
4. File must export default
5. Must call `.done()` at the end
6. Severity must be `'error'` or `'warn'` (NOT `'warning'`)
7. Type must be one or more of: `'static'`, `'analytics'`, `'test'`, `'informational'`
8. `.rule()` method is required UNLESS rule type is only `'informational'`
9. `.appliesTo()` can take one or more participants
10. Custom validation functions in Pattern C (with `validateCommonHttpTransactions`) return `boolean` (true = violation detected)
11. Custom validation functions in Pattern D (with `validateGroupedCommonHttpTransactions`) return `RuleViolation | undefined`

---

_Last Updated: 2025-12-12_
_Based on RFC 9110 (June 2022)_
