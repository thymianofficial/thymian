---
name: generate-rfc-rule
description: Generate RFC rules from RFC text excerpts. Use this skill when asked to implement, create, or extract rules from RFC documents (RFC 9110, RFC 9111, etc.). Triggers include "implement RFC rule", "create rule from RFC", "extract rules", "add RFC requirement", "implement [MUST/SHOULD/MAY] from RFC".
---

# Generate RFC Rule Skill

This skill helps implement HTTP rules from RFC documents following the existing patterns in RFC rule packages (e.g., `rfc-9110-rules`).

## File Locations

**First, identify the target RFC package:**

- List existing RFC packages: `ls packages/rfc-*-rules/`
- Common examples: `rfc-9110-rules`, `rfc-9111-rules`, etc.

**Standard locations within an RFC package:**

- **Rules directory**: `packages/rfc-{number}-rules/src/rules/`
- **Rule index**: `packages/rfc-{number}-rules/src/index.ts`
- **RFC document**: Local file path provided by user or https://www.rfc-editor.org/rfc/rfc{number}.html

## Rule Structure

RFC rules follow a consistent pattern using the `httpRule` builder API from `@thymian/http-linter`. Examine existing rules in the target package to understand the specific patterns and conventions used.

## Steps

### 1. Analyze the RFC Text

Given RFC text (short excerpt or full context), identify:

1. **The requirement keyword**: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY, MAY NOT
2. **The actor/role**: Who must follow this rule?
   - `client` - HTTP client
   - `server` - HTTP server (origin or intermediary)
   - `origin server` - Origin server specifically
   - `proxy` - Proxy/intermediary server
   - `user-agent` - User agent/browser
   - `cache` - HTTP cache
3. **The condition**: When does this rule apply? (e.g., specific HTTP method, status code, header presence)
4. **The constraint**: What is being required, prohibited, or recommended?

**Example RFC Text:**

> "A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported."

**Analysis:**

- Keyword: `SHOULD NOT`
- Actor: `client`
- Condition: DELETE request
- Constraint: No request body (unless specific conditions)

### 2. Determine the Rule Name

Create a kebab-case rule name following this pattern:

```
{actor}-{keyword}-{constraint}-{condition}.rule.ts
```

**Naming Guidelines:**

- Use lowercase with hyphens
- Start with the actor (client, server, origin-server, proxy, cache, user-agent)
- Include the RFC keyword (must, should, may)
- Describe the constraint concisely
- Add condition if relevant (for-METHOD, in-STATUS-response, etc.)
- End with `.rule.ts`

**Examples:**

- `client-should-not-generate-content-for-delete-request.rule.ts`
- `server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request.rule.ts`
- `origin-server-must-disable-safe-methods-for-unsafe-resources.rule.ts`
- `user-agent-may-repeat-request-with-new-authorization-header.rule.ts`

### 3. Determine Directory Structure

Organize rules by RFC section. **Always examine the existing directory structure** in the target RFC package to follow established conventions.

**Example structure (RFC 9110):**

```
packages/rfc-9110-rules/src/rules/
├── methods/
│   ├── method-definitions/
│   │   ├── get/
│   │   ├── post/
│   │   ├── delete/
│   │   └── ...
│   └── method-properties/
├── status-codes/
│   ├── client-error-4xx/
│   │   ├── 401/
│   │   ├── 403/
│   │   └── ...
│   └── server-error-5xx/
├── headers/
│   ├── request-headers/
│   └── response-headers/
└── fields.ts
```

**Guidelines:**

- Group by major RFC section (structure varies by RFC)
- Further subdivide by specific topics when applicable
- Place general rules at the section root
- Create directories as needed to maintain organization
- **Follow the existing pattern** in the target package

**Smart Folder Structure Decision:**

Avoid creating deeply nested folders when subsections contain sparse rules. Use content-based decisions:

**When to create subfolders:**

- A subsection contains **5+ rules** → Create dedicated subfolder
- Multiple subsections each have **3+ rules** → Create subfolders for each
- Clear logical grouping with substantial content → Create subfolder

**When to keep rules in parent folder:**

- A section has 4 subsections but only 2 subsections contain 1-2 rules each → Keep all in parent folder
- Subsections have minimal content (1-2 rules each) → Keep in parent folder named after the section
- Creating subfolders would result in mostly empty directories → Keep in parent folder

**Example - Sparse content (DON'T create subfolders):**

```
Section 12.4 Content Negotiation
  12.4.1 (has 1 rule)
  12.4.2 (no rules)
  12.4.3 (no rules)
  12.4.4 (has 1 rule)

✓ Correct: packages/rfc-9110-rules/src/rules/content-negotiation/
  ├── rule-from-12.4.1.rule.ts
  └── rule-from-12.4.4.rule.ts

✗ Wrong: packages/rfc-9110-rules/src/rules/content-negotiation/12.4.1/rule.ts
```

**Example - Dense content (DO create subfolders):**

```
Section 12.4 Content Negotiation
  12.4.1 (has 8 rules)
  12.4.2 (has 6 rules)
  12.4.3 (has 10 rules)
  12.4.4 (has 7 rules)

✓ Correct: packages/rfc-9110-rules/src/rules/content-negotiation/
  ├── 12.4.1/
  ├── 12.4.2/
  ├── 12.4.3/
  └── 12.4.4/
```

**When unclear:**

- Examine the current state of the section structure
- Count rules in each subsection
- If the decision is ambiguous, **ask the user** for their preference
- Document the decision for consistency with future rules in the same section

### 4. Determine Severity

Map RFC keywords to severity levels:

| RFC Keyword                                    | Severity | Description                                  |
| ---------------------------------------------- | -------- | -------------------------------------------- |
| MUST / MUST NOT / REQUIRED / SHALL / SHALL NOT | `error`  | Absolute requirement or prohibition          |
| SHOULD / SHOULD NOT / RECOMMENDED              | `warn`   | Strong recommendation but exceptions allowed |
| MAY / OPTIONAL                                 | `hint`   | Truly optional, informational                |

**Rule of thumb:**

- Protocol violations that break interoperability → `error`
- Best practices with valid exceptions → `warn`
- Optional features or informational guidance → `hint`

### 5. Determine Rule Type

Specify whether the rule is `static` (can be validated statically) or requires runtime analysis:

| Type            | When to Use                                    | Examples                       |
| --------------- | ---------------------------------------------- | ------------------------------ |
| `static`        | Can be validated by examining request/response | Header presence, method checks |
| `analytics`     | Requires runtime observation or analytics      | Behavior patterns, retry logic |
| `informational` | Guidance without validation logic              | General recommendations        |

**Common patterns:**

- `static` - Most header/method/status code rules
- `analytics` - Rules about client behavior, retry patterns, caching decisions
- `informational` - Architecture guidance without concrete validation

**Multiple types**: A rule can have both types if it has both static and behavioral components:

```typescript
.type('static', 'analytics')
```

### 6. Determine the Actor

Use the `.appliesTo()` method to specify who must follow this rule:

```typescript
.appliesTo('client')      // HTTP client
.appliesTo('server')      // HTTP server (any)
.appliesTo('origin server') // Origin server specifically
.appliesTo('proxy')       // Proxy/intermediary
.appliesTo('user-agent')  // User agent/browser
.appliesTo('cache')       // HTTP cache
```

### 7. Extract the RFC URL

Construct the RFC section URL:

**Format**: `https://www.rfc-editor.org/rfc/rfc{number}.html#name-{section-slug}`

**Examples:**

- `https://www.rfc-editor.org/rfc/rfc9110.html#name-delete`
- `https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized`
- `https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods`

**Tips:**

- Convert section titles to lowercase-with-hyphens
- Remove special characters
- Check the actual RFC document to verify the anchor exists

### 8. Write Description and Summary

**Description** (`.description()`):

- Copy the relevant RFC text verbatim or paraphrase closely
- Include context needed to understand the requirement
- Can be multiple sentences

**Summary** (`.summary()` - optional):

- One-sentence distillation of the requirement
- Used when description is long
- Typically just the core normative statement

**Guidelines:**

- Prefer description for most rules
- Add summary when description exceeds 2-3 sentences
- Keep exact RFC phrasing when possible

### 9. Implement the Validation Logic

Use the `.rule()` method to implement validation logic using the constraint matcher API:

```typescript
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    // condition matcher
    and(method('DELETE'), hasRequestBody()),
    // constraint matcher (what should be flagged)
    hasRequestBody()
  )
)
```

**Common Matchers:**

**Method matchers:**

```typescript
method('GET');
method('POST');
not(method('GET'));
```

**Status code matchers:**

```typescript
statusCode(401);
statusCodeRange(200, 299); // 2xx responses
```

**Header matchers:**

```typescript
requestHeader('content-length');
responseHeader('transfer-encoding');
not(requestHeader('authorization'));
or(responseHeader('content-length'), responseHeader('transfer-encoding'));
```

**Body matchers:**

```typescript
hasRequestBody();
hasResponseBody();
```

**Logical operators:**

```typescript
and(matcher1, matcher2);
or(matcher1, matcher2);
not(matcher);
```

**Validation patterns:**

1. **Flag presence when something shouldn't exist:**

```typescript
// MUST NOT send header
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    method('CONNECT'),  // condition
    responseHeader('content-length')  // flag this
  )
)
```

2. **Flag absence when something should exist:**

```typescript
// MUST send header
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    method('OPTIONS'),  // condition
    not(requestHeader('max-forwards'))  // flag this absence
  )
)
```

3. **Complex conditions:**

```typescript
// Server MUST NOT send certain headers in 2xx CONNECT responses
.rule((ctx) =>
  ctx.validateCommonHttpTransactions(
    and(method('CONNECT'), statusCodeRange(200, 299)),
    or(responseHeader('transfer-encoding'), responseHeader('content-length'))
  )
)
```

4. **Informational rules (no validation):**

```typescript
// For purely informational rules with no concrete validation
.done()  // Skip .rule() entirely
```

### 10. Complete the Rule

Call `.done()` to finalize the rule. The rule ID format is `rfc{number}/rule-name`:

```typescript
export default httpRule('rfc9110/rule-name')  // Use appropriate RFC number
  .severity('error')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section')
  .description('The normative text from RFC')
  .appliesTo('client')
  .rule((ctx) => /* validation logic */)
  .done();
```

**Rule ID pattern**: `rfc{number}/{kebab-case-rule-name}`

- Examples: `rfc9110/client-should-not-generate-content`, `rfc9111/cache-must-validate-stale-response`

## Complete Examples

The following examples are from RFC 9110. Adapt the patterns for other RFCs.

### Example 1: Simple SHOULD NOT Rule (RFC 9110)

**RFC Text:** "A client SHOULD NOT generate content in a DELETE request."

**Implementation:**

```typescript
import { hasRequestBody, method } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-should-not-generate-content-for-delete-request')
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description('A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported.')
  .appliesTo('client')
  .rule((ctx) => ctx.validateCommonHttpTransactions(method('DELETE'), hasRequestBody()))
  .done();
```

**File:** `packages/rfc-9110-rules/src/rules/methods/method-definitions/delete/client-should-not-generate-content-for-delete-request.rule.ts`

### Example 2: Complex MUST NOT Rule with Multiple Conditions (RFC 9110)

**RFC Text:** "A server MUST NOT send any Transfer-Encoding or Content-Length header fields in a 2xx (Successful) response to CONNECT."

**Implementation:**

```typescript
import { and, method, or, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description('A server MUST NOT send any Transfer-Encoding or Content-Length header fields in a 2xx (Successful) response to CONNECT.')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(method('CONNECT'), statusCodeRange(200, 299)), or(responseHeader('transfer-encoding'), responseHeader('content-length'))))
  .done();
```

**File:** `packages/rfc-9110-rules/src/rules/methods/method-definitions/connect/server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request.rule.ts`

### Example 3: MAY Rule (Informational) (RFC 9110)

**RFC Text:** "The user agent MAY repeat the request with a new or replaced Authorization header field."

**Implementation:**

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/user-agent-may-repeat-request-with-new-authorization-header').severity('hint').type('analytics').url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized').summary('The user agent MAY repeat the request with a new or replaced Authorization header field.').description('If the request included authentication credentials, then the 401 response indicates that authorization has been refused for those credentials. The user agent MAY repeat the request with a new or replaced Authorization header field.').appliesTo('user-agent').done();
```

**File:** `packages/rfc-9110-rules/src/rules/status-codes/client-error-4xx/401/user-agent-may-repeat-request-with-new-authorization-header.rule.ts`

### Example 4: Informational MUST Rule (RFC 9110)

**RFC Text:** "If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method."

**Implementation:**

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-server-must-disable-safe-methods-for-unsafe-resources').severity('error').type('informational').url('https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods').summary('If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method.').description('When a resource is constructed such that parameters within the target URI have the effect of selecting an action, it is the resource owner\'s responsibility to ensure that the action is consistent with the request method semantics. For example, it is common for Web-based content editing software to use actions within query parameters, such as "page?do=delete". If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method.').appliesTo('origin server').done();
```

**File:** `packages/rfc-9110-rules/src/rules/methods/method-properties/origin-server-must-disable-safe-methods-for-unsafe-resources.rule.ts`

## Validation Checklist

When creating a new RFC rule, verify:

- [ ] Rule name follows kebab-case convention with actor-keyword-constraint pattern
- [ ] File is placed in appropriate directory based on RFC section
- [ ] Severity correctly maps RFC keyword (MUST→error, SHOULD→warn, MAY→hint)
- [ ] Type is set appropriately (static, analytics, informational)
- [ ] Actor is specified with `.appliesTo()`
- [ ] RFC URL points to correct section with valid anchor
- [ ] Description contains relevant RFC text (exact or paraphrased)
- [ ] Summary is added if description is long
- [ ] Validation logic uses appropriate matchers
- [ ] Rule is exported as default
- [ ] Imports are from `@thymian/core` and `@thymian/http-linter` or `@thymian/http-testing`
- [ ] Rule ends with `.done()`

## Notes

- **Rule discovery**: Rulesets typically use glob pattern `rules/**/*.rule.js` to auto-discover rules (check the package's `src/index.ts`)
- **No manual registration**: Rules are automatically included if placed in the correct directory structure
- **Testing**: After creating rules, verify with appropriate tests in the package
- **Context**: When uncertain about validation logic, examine similar existing rules for patterns
- **MAY rules**: Often don't need validation logic—they're informational about optional behavior
- **Package-specific patterns**: Each RFC package may have unique conventions—always review existing rules first
