# HTTP Authentication (RFC 9110 Section 11) - LLM Execution Plan

## 🤖 TL;DR for LLMs - Start Here!

**Task:** Implement 12 HTTP authentication rules as Thymian linting rules.

**Good News:** 10 out of 12 rules are simple! Just copy templates and use built-in functions.

**Execution Order:**

1. **Phase 1:** Create directory structure (1 command)
2. **Phase 2:** Implement Rules 2 & 3 (simple, copy-paste from examples) ← START HERE
3. **Phase 3:** Create `auth-parser.ts` utilities (for Rules 1 & 6)
4. **Phase 4:** Implement Rules 1 & 6 (use parser utilities)
5. **Phase 5:** Implement Rules 4 & 5 (analytics rules)
6. **Phase 6:** Implement Rules 8-11 (proxy test rules - most complex)
7. **Phase 7:** Implement Rules 7 & 12 (informational rules)

**Critical Rules:** Use `statusCode()`, `responseHeader()`, `requestHeader()`, `not()` from `@thymian/core` - DON'T create wrapper functions!

**Progress Tracking:** Update status 🔴→🟡→🟢 as you work. Add notes in "LLM Notes" sections.

**Jump to:** [Step-by-Step Guide](#step-by-step-execution-guide) | [Rules List](#rules-to-implement) | [Checklist](#rule-implementation-checklist)

---

## 🤖 LLM Execution Instructions

**IMPORTANT: This document is designed for LLM execution. Follow the sections sequentially.**

### How to Use This Document

1. **Read the [Quick Start](#quick-start-for-llm-execution) section first**
2. **Follow the [Step-by-Step Execution Guide](#step-by-step-execution-guide)**
3. **Use the [Rule Implementation Checklist](#rule-implementation-checklist) to track progress**
4. **Refer to [Rule Details](#rules-to-implement) for specific implementation requirements**
5. **Update status indicators as you complete each rule**

---

## Quick Start for LLM Execution

### Overview

Implement HTTP Authentication rules from RFC 9110 Section 11 as Thymian linting rules.

**RFC Reference:** https://www.rfc-editor.org/rfc/rfc9110.html#name-http-authentication

**Date Created:** 2025-12-05

### 🎯 Critical Information for LLM

**Most rules are simple!** Thymian provides all necessary filter functions.

- ✅ **10 out of 12 rules** use only built-in filters from `@thymian/core`
- ✅ Use `responseHeader()`, `requestHeader()`, `statusCode()` directly - NO wrapper functions needed
- ⚠️ Only **Rules 1 and 6** require custom parsing utilities

### Quick Reference: All 12 Rules

**Simple Rules (Use Template - 10 rules):**

- Rule 2: 401 → WWW-Authenticate (P0, error, simple filter)
- Rule 3: 407 → Proxy-Authenticate (P0, error, simple filter)
- Rule 4: Invalid creds → 401 (P1, warning, analytics)
- Rule 5: Invalid proxy creds → 407 (P1, warning, analytics)
- Rule 7: WWW-Authenticate in non-401 (P2, info, informational)
- Rule 8: Proxy must not modify WWW-Authenticate (P0, error, test mode)
- Rule 9: Proxy must not modify Authorization (P0, error, test mode)
- Rule 10: Proxy must not modify Authentication-Info (P0, error, test mode)
- Rule 11: Proxy must consume Proxy-Authorization (P0, error, test mode, complex)
- Rule 12: Proxy-Authentication-Info scope (P2, info, informational)

**Complex Rules (Need Parser - 2 rules):**

- Rule 1: Parameter uniqueness (P0, error, needs `parseAuthenticationHeader`, `hasDuplicateParameters`)
- Rule 6: Realm quoted-string (P0, error, needs `parseAuthenticationHeader`, `isQuotedString`)

**Implementation Priority:**

1. **Phase 2 (Start here!):** Rules 2, 3 (simple, critical)
2. **Phase 3:** Create parser utilities
3. **Phase 4:** Rules 1, 6 (complex, critical)
4. **Phase 5:** Rules 4, 5 (analytics, high)
5. **Phase 6:** Rules 8-11 (proxy test, critical but complex)
6. **Phase 7:** Rules 7, 12 (informational, low priority)

### 🚨 Common Pitfalls for LLMs (READ THIS!)

**DON'T:**

1. ❌ Create wrapper functions like `hasWWWAuthenticateHeader()` - use `responseHeader('www-authenticate')` directly
2. ❌ Create custom filter functions that duplicate Thymian's built-in filters
3. ❌ Implement all rules at once - follow the phase order
4. ❌ Forget to update status indicators (🔴→🟡→🟢) as you progress
5. ❌ Skip creating the directory structure (Phase 1)
6. ❌ Use incorrect file paths or naming conventions

**DO:**

1. ✅ Use `statusCode()`, `responseHeader()`, `requestHeader()`, `not()` directly from `@thymian/core`
2. ✅ Follow the exact file naming convention: `[actor]-[modal-verb]-[action]-[context].rule.ts`
3. ✅ Copy the complete implementation code provided in each rule
4. ✅ Update the "LLM Notes" section after completing each rule
5. ✅ Verify TypeScript compiles after each rule
6. ✅ Complete simpler rules (2, 3, 7, 12) before complex rules (1, 6)

---

## Step-by-Step Execution Guide

### Phase 1: Setup (Do This First)

1. **Create directory structure:**

   ```bash
   mkdir -p packages/rfc-9110-rules/src/rules/authentication/{parameters,challenge-response,credentials,realm,origin-server/{www-authenticate,authorization,authentication-info},proxy/{proxy-authenticate,proxy-authorization,proxy-authentication-info}}
   ```

2. **Verify Thymian imports are available:**
   - Check that `@thymian/core` exports: `statusCode`, `responseHeader`, `requestHeader`, `not`, `and`, `or`
   - Check that `@thymian/http-linter` exports: `httpRule`

### Phase 2: Implement Simple Rules (Rules 2, 3, 7, 12)

**These rules are straightforward - just header presence checks.**

**Order of implementation:**

1. Rule 2: `server-must-send-www-authenticate-in-401-response` (CRITICAL)
2. Rule 3: `proxy-must-send-proxy-authenticate-in-407-response` (CRITICAL)
3. Rule 7: `server-may-send-www-authenticate-in-non-401-responses` (INFO)
4. Rule 12: `proxy-authentication-info-applies-to-next-outbound-client` (INFO)

**For each rule:**

- Copy the template from [Rule Template](#rule-template)
- Fill in the rule ID, severity, description, URL
- Use two filters: one to select transactions, one to identify violations
- See [Example 1](#example-1-simple-header-presence-check-rule-2-401-must-include-www-authenticate) for reference
- Update status to 🟢 when complete

### Phase 3: Implement Parser Utilities (For Rules 1 & 6)

**Only needed once for both rules.**

Create `packages/rfc-9110-rules/src/rules/authentication/utils/auth-parser.ts`:

```typescript
/**
 * Parse authentication challenge from WWW-Authenticate or Proxy-Authenticate header
 * Returns array of challenges, each with scheme and parameters
 */
export function parseAuthenticationHeader(headerValue: string): Array<{
  scheme: string;
  parameters: Record<string, string>;
}>;

/**
 * Check if a challenge has duplicate parameter names (case-insensitive)
 */
export function hasDuplicateParameters(challenge: { parameters: Record<string, string> }): boolean;

/**
 * Check if a parameter value uses quoted-string syntax (enclosed in quotes)
 */
export function isQuotedString(value: string): boolean;
```

### Phase 4: Implement Parser-Dependent Rules (Rules 1 & 6)

**These rules require the parser utilities from Phase 3.**

**Order of implementation:**

1. Rule 1: `authentication-parameter-name-must-occur-once-per-challenge` (CRITICAL)
2. Rule 6: `realm-parameter-must-use-quoted-string-syntax` (CRITICAL)

**For each rule:**

- Import the parser utilities
- Use custom validation logic (see [Example 3](#example-3-complex-parameter-validation-rule-1---requires-custom-parsing))
- Update status to 🟢 when complete

### Phase 5: Implement Analytics Rules (Rules 4 & 5)

**These rules use heuristics to detect missing authentication.**

**Order of implementation:**

1. Rule 4: `origin-server-should-send-401-for-invalid-credentials` (HIGH)
2. Rule 5: `proxy-should-send-407-for-invalid-proxy-credentials` (HIGH)

### Phase 6: Implement Proxy Test Rules (Rules 8-11)

**These rules require test mode with proxy setup.**

**⚠️ IMPORTANT:** These rules test proxy behavior and require special test infrastructure.

**Order of implementation:**

1. Rule 8: `proxy-must-not-modify-www-authenticate-header` (CRITICAL)
2. Rule 9: `proxy-must-not-modify-authorization-header` (CRITICAL)
3. Rule 10: `proxy-must-not-modify-authentication-info-header` (CRITICAL)
4. Rule 11: `proxy-must-consume-proxy-authorization-header` (CRITICAL, COMPLEX)

---

## Rule Implementation Checklist

**Track your progress by updating status indicators:**

### Critical Rules (P0) - Implement First

- [ ] 🔴 Rule 2: `server-must-send-www-authenticate-in-401-response` → Simple
- [ ] 🔴 Rule 3: `proxy-must-send-proxy-authenticate-in-407-response` → Simple
- [ ] 🔴 Rule 1: `authentication-parameter-name-must-occur-once-per-challenge` → Needs parser
- [ ] 🔴 Rule 6: `realm-parameter-must-use-quoted-string-syntax` → Needs parser
- [ ] 🔴 Rule 8: `proxy-must-not-modify-www-authenticate-header` → Needs proxy test
- [ ] 🔴 Rule 9: `proxy-must-not-modify-authorization-header` → Needs proxy test
- [ ] 🔴 Rule 10: `proxy-must-not-modify-authentication-info-header` → Needs proxy test
- [ ] 🔴 Rule 11: `proxy-must-consume-proxy-authorization-header` → Complex proxy test

### High Priority Rules (P1) - Implement Second

- [ ] 🔴 Rule 4: `origin-server-should-send-401-for-invalid-credentials` → Analytics
- [ ] 🔴 Rule 5: `proxy-should-send-407-for-invalid-proxy-credentials` → Analytics

### Medium Priority Rules (P2) - Implement Last

- [ ] 🔴 Rule 7: `server-may-send-www-authenticate-in-non-401-responses` → Simple (info only)
- [ ] 🔴 Rule 12: `proxy-authentication-info-applies-to-next-outbound-client` → Simple (info only)

---

## Migration Progress Tracking

### Overall Status

- **Total Rules:** 12
- **Completed:** 0
- **In Progress:** 0
- **Not Started:** 12
- **Blocked:** 0

### Current Phase

**Phase:** Not Started
**Started:** N/A

### Migration Notes

_LLM: Update this section as you make progress. Note any blockers, decisions, or deviations from the plan._

---

## LLM Implementation Requirements

### File Naming Convention

**CRITICAL:** Use this exact pattern for all rule files:

```
[actor]-[modal-verb]-[action]-[context].rule.ts
```

**Examples:**

- `server-must-send-www-authenticate-in-401-response.rule.ts`
- `proxy-must-not-modify-authorization-header.rule.ts`

### File Placement

**Place each rule file in the appropriate subdirectory:**

| Rule    | Directory                                         |
| ------- | ------------------------------------------------- |
| Rule 1  | `authentication/parameters/`                      |
| Rule 2  | `authentication/origin-server/www-authenticate/`  |
| Rule 3  | `authentication/proxy/proxy-authenticate/`        |
| Rule 4  | `authentication/credentials/`                     |
| Rule 5  | `authentication/credentials/`                     |
| Rule 6  | `authentication/realm/`                           |
| Rule 7  | `authentication/origin-server/www-authenticate/`  |
| Rule 8  | `authentication/proxy/`                           |
| Rule 9  | `authentication/proxy/`                           |
| Rule 10 | `authentication/proxy/`                           |
| Rule 11 | `authentication/proxy/proxy-authorization/`       |
| Rule 12 | `authentication/proxy/proxy-authentication-info/` |

### Required Imports

**For simple rules (2, 3, 4, 5, 7-12):**

```typescript
import { statusCode, responseHeader, requestHeader, not, and, or } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
```

**For complex rules (1, 6):**

```typescript
import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { parseAuthenticationHeader, hasDuplicateParameters, isQuotedString } from '../utils/auth-parser';
```

---

## Rules to Implement

### 🤖 LLM Instructions for Each Rule

**For each rule below, follow these steps:**

1. **Read** the rule specification carefully
2. **Identify** if it's a simple rule (use template) or complex rule (needs parser)
3. **Create** the file in the correct directory with the correct filename
4. **Implement** the rule using the template or example as reference
5. **Update** the rule status from 🔴 to 🟡 (in progress), then to 🟢 (completed)
6. **Verify** TypeScript compiles without errors
7. **Add notes** in the "LLM Notes" section about any issues or decisions

**Note:** Rules 1-3 have been fully formatted for LLM execution with complete implementation code. Rules 4-12 follow the same pattern - look for the "🤖 LLM Action" header, **File** path, and follow the implementation logic provided. For simple rules, copy the pattern from Rules 2-3.

### Status Legend

- 🔴 **Not Started**: Rule has not been worked on yet
- 🟡 **In Progress**: Rule implementation is currently underway (UPDATE THIS WHEN YOU START)
- 🟢 **Completed**: Rule has been fully implemented (UPDATE THIS WHEN DONE)
- ⏸️ **Blocked**: Rule is blocked by a dependency (UPDATE THIS IF BLOCKED)

### Priority Legend

- **P0**: Critical - MUST/MUST NOT requirements (implement first)
- **P1**: High - SHOULD/SHOULD NOT requirements (implement second)
- **P2**: Medium - MAY requirements (implement last)

---

## 11.2 Authentication Parameters

### Rule 1: Parameter Name Uniqueness

**🤖 LLM Action:** Complex rule - implement in Phase 4 (after creating parser utilities)

**File:** `authentication/parameters/authentication-parameter-name-must-occur-once-per-challenge.rule.ts`

**Status:** 🔴 Not Started ← **UPDATE THIS AS YOU WORK**

**Priority:** P0 (CRITICAL)

**Implementation Type:** Complex - requires custom parser utilities

---

**Rule ID:** `rfc9110/authentication-parameter-name-must-occur-once-per-challenge`

**RFC Section:** 11.2 | **RFC Link:** https://www.rfc-editor.org/rfc/rfc9110.html#section-11.2

**RFC Quote:**

> "Authentication parameters are name/value pairs, where the name token is matched case-insensitively and each parameter name MUST only occur once per challenge."

**Severity:** `error` | **Type:** `static` | **Applies To:** `server`, `proxy`

**Description:**
Each authentication parameter name must occur only once per challenge in WWW-Authenticate and Proxy-Authenticate headers.

**Implementation Steps:**

1. Use `responseHeader('www-authenticate')` to filter responses with the header
2. Use `parseAuthenticationHeader()` to parse challenges
3. Use `hasDuplicateParameters()` to check for duplicates
4. Report violations

**Example Test Cases:**

```typescript
// ✓ Valid
'WWW-Authenticate: Basic realm="test"';
'WWW-Authenticate: Digest realm="test", nonce="abc"';

// ✗ Invalid (duplicate realm)
'WWW-Authenticate: Digest realm="test", realm="other"';
'Proxy-Authenticate: Basic Realm="test", REALM="other"'; // case-insensitive
```

**Dependencies:** Requires `auth-parser.ts` utilities (Phase 3)

**LLM Notes:**
_Add your implementation notes here. Document any issues, decisions, or questions._

---

## 11.3 Challenge and Response

### Rule 2: 401 Response Must Include WWW-Authenticate

**Rule ID:** `rfc9110/server-must-send-www-authenticate-in-401-response`

**Status:** 🔴 Not Started

**Priority:** P0

**RFC Section:** 11.6.1

**RFC Quote:**

> "A server generating a 401 (Unauthorized) response MUST send a WWW-Authenticate header field containing at least one challenge."

**Severity:** error

**Type:** analytics, test

**Applies To:** server

**Description:**
Origin servers must include a WWW-Authenticate header field with at least one challenge in 401 (Unauthorized) responses.

**Validation Logic:**

- Filter responses with status code 401
- Check for presence of WWW-Authenticate header
- Verify the header contains at least one valid challenge
- Report 401 responses missing WWW-Authenticate header

**Test Scenarios:**

- ✓ Valid: `401 Unauthorized` with `WWW-Authenticate: Basic realm="test"`
- ✓ Valid: `401 Unauthorized` with multiple challenges
- ✗ Invalid: `401 Unauthorized` without WWW-Authenticate header
- ✗ Invalid: `401 Unauthorized` with empty WWW-Authenticate header

**Implementation Notes:**

- This is a MUST requirement (error severity)
- Applies only to origin servers, not proxies
- Multiple WWW-Authenticate headers are allowed

**Complete Implementation:**

```typescript
import { statusCode, responseHeader, not } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-send-www-authenticate-in-401-response')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.1')
  .description('A server generating a 401 (Unauthorized) response MUST send a WWW-Authenticate header field containing at least one challenge.')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  .done();
```

**LLM Notes:**
_Add your implementation notes here._

---

### Rule 3: 407 Response Must Include Proxy-Authenticate

**🤖 LLM Action:** Simple rule - implement in Phase 2 (second rule)

**File:** `authentication/proxy/proxy-authenticate/proxy-must-send-proxy-authenticate-in-407-response.rule.ts`

**Status:** 🔴 Not Started ← **UPDATE THIS AS YOU WORK**

**Priority:** P0 (CRITICAL)

**Implementation Type:** Simple - use built-in filters only

---

**Rule ID:** `rfc9110/proxy-must-send-proxy-authenticate-in-407-response`

**RFC Section:** 11.7.1 | **RFC Link:** https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7.1

**RFC Quote:**

> "A proxy MUST send at least one Proxy-Authenticate header field in each 407 (Proxy Authentication Required) response that it generates."

**Severity:** `error` | **Type:** `analytics` | **Applies To:** `proxy`

**Description:**
Proxies must include a Proxy-Authenticate header field in 407 (Proxy Authentication Required) responses.

**Complete Implementation:**

```typescript
import { statusCode, responseHeader, not } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-send-proxy-authenticate-in-407-response')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7.1')
  .description('A proxy MUST send at least one Proxy-Authenticate header field in each 407 (Proxy Authentication Required) response that it generates.')
  .appliesTo('proxy')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(407), not(responseHeader('proxy-authenticate'))))
  .done();
```

**LLM Notes:**
_Add your implementation notes here._

---

## 11.4 Credentials

### Rule 4: Server Should Send 401 for Invalid Credentials

**🤖 LLM Action:** Analytics rule - implement in Phase 5 (after simple rules)

**File:** `authentication/credentials/origin-server-should-send-401-for-invalid-credentials.rule.ts`

**Status:** 🔴 Not Started ← **UPDATE THIS AS YOU WORK**

**Priority:** P1 (HIGH)

**RFC Section:** 11.4

**RFC Quote:**

> "Upon receipt of a request for a protected resource that omits credentials, contains invalid credentials (e.g., a bad password) or partial credentials (e.g., when the authentication scheme requires more than one round trip), an origin server SHOULD send a 401 (Unauthorized) response that contains a WWW-Authenticate header field with at least one (possibly new) challenge applicable to the requested resource."

**Severity:** warning

**Type:** analytics

**Applies To:** server

**Description:**
Origin servers should send 401 responses with WWW-Authenticate header for requests with missing, invalid, or partial credentials.

**Validation Logic:**

- Identify requests for protected resources (heuristic: has Authorization header or receives 401)
- Check if requests with invalid/missing Authorization receive 401 responses
- Verify 401 responses include WWW-Authenticate header
- Report non-401 responses to likely authentication failures

**Test Scenarios:**

- ✓ Valid: Request with no Authorization → `401` with WWW-Authenticate
- ✓ Valid: Request with invalid Authorization → `401` with WWW-Authenticate
- ⚠ Warning: Request with no Authorization → `403 Forbidden`
- ⚠ Warning: Request with invalid Authorization → `200 OK`

**Implementation Notes:**

- This is a SHOULD requirement (warning severity)
- Distinguishing invalid credentials from valid-but-insufficient credentials is challenging
- 403 responses indicate valid credentials but insufficient access (different case)

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

### Rule 5: Proxy Should Send 407 for Invalid Proxy Credentials

**Rule ID:** `rfc9110/proxy-should-send-407-for-invalid-proxy-credentials`

**Status:** 🔴 Not Started

**Priority:** P1

**RFC Section:** 11.4

**RFC Quote:**

> "Likewise, upon receipt of a request that omits proxy credentials or contains invalid or partial proxy credentials, a proxy that requires authentication SHOULD generate a 407 (Proxy Authentication Required) response that contains a Proxy-Authenticate header field with at least one (possibly new) challenge applicable to the proxy."

**Severity:** warning

**Type:** analytics

**Applies To:** proxy

**Description:**
Proxies requiring authentication should send 407 responses with Proxy-Authenticate header for requests with missing, invalid, or partial proxy credentials.

**Validation Logic:**

- Identify proxy authentication scenarios
- Check if requests with invalid/missing Proxy-Authorization receive 407 responses
- Verify 407 responses include Proxy-Authenticate header
- Report non-407 responses to likely proxy authentication failures

**Test Scenarios:**

- ✓ Valid: Request with no Proxy-Authorization → `407` with Proxy-Authenticate
- ✓ Valid: Request with invalid Proxy-Authorization → `407` with Proxy-Authenticate
- ⚠ Warning: Request with no Proxy-Authorization → `403 Forbidden`
- ⚠ Warning: Request with invalid Proxy-Authorization → `200 OK`

**Implementation Notes:**

- This is a SHOULD requirement (warning severity)
- Applies only to proxies that require authentication
- Detection may require proxy-specific configuration

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## 11.5 Establishing a Protection Space (Realm)

### Rule 6: Realm Value Must Use Quoted-String Syntax

**Rule ID:** `rfc9110/realm-parameter-must-use-quoted-string-syntax`

**Status:** 🔴 Not Started

**Priority:** P0

**RFC Section:** 11.5

**RFC Quote:**

> "For historical reasons, a sender MUST only generate the quoted-string syntax. Recipients might have to support both token and quoted-string syntax for maximum interoperability with existing clients that have been accepting both notations for a long time."

**Severity:** error

**Type:** static, analytics

**Applies To:** server, proxy

**Description:**
Servers and proxies must use quoted-string syntax (not token syntax) for realm parameter values in WWW-Authenticate and Proxy-Authenticate headers.

**Validation Logic:**

- Parse WWW-Authenticate and Proxy-Authenticate headers
- Identify realm parameters in challenges
- Check that realm values use quoted-string syntax (enclosed in quotes)
- Report realm parameters using token syntax

**Test Scenarios:**

- ✓ Valid: `WWW-Authenticate: Basic realm="protected area"`
- ✓ Valid: `Proxy-Authenticate: Digest realm="proxy realm"`
- ✗ Invalid: `WWW-Authenticate: Basic realm=protected` (token syntax)
- ✗ Invalid: `Proxy-Authenticate: Basic realm=test` (token syntax)

**Implementation Notes:**

- This is a MUST requirement for senders (error severity)
- Applies to both WWW-Authenticate and Proxy-Authenticate
- Recipients should accept both formats for compatibility

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## 11.6.1 WWW-Authenticate

### Rule 7: Server May Send WWW-Authenticate in Non-401 Responses

**Rule ID:** `rfc9110/server-may-send-www-authenticate-in-non-401-responses`

**Status:** 🔴 Not Started

**Priority:** P2

**RFC Section:** 11.6.1

**RFC Quote:**

> "A server MAY generate a WWW-Authenticate header field in other response messages to indicate that supplying credentials (or different credentials) might affect the response."

**Severity:** info

**Type:** static, analytics

**Applies To:** server

**Description:**
Servers may include WWW-Authenticate header in responses other than 401 to indicate that credentials might affect the response.

**Validation Logic:**

- Informational rule - no violations
- Document that WWW-Authenticate in non-401 responses is valid
- Could track usage patterns for analytics

**Test Scenarios:**

- ✓ Valid: `200 OK` with `WWW-Authenticate: Basic realm="optional"`
- ✓ Valid: `403 Forbidden` with `WWW-Authenticate: Bearer realm="api"`
- ℹ Info: WWW-Authenticate in 2xx, 3xx, 4xx (non-401), 5xx responses is allowed

**Implementation Notes:**

- This is a MAY requirement (informational)
- Useful for preemptive authentication scenarios
- Does not indicate an error

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

### Rule 8: Proxy Must Not Modify WWW-Authenticate Header

**Rule ID:** `rfc9110/proxy-must-not-modify-www-authenticate-header`

**Status:** 🔴 Not Started

**Priority:** P0

**RFC Section:** 11.6.1

**RFC Quote:**

> "A proxy forwarding a response MUST NOT modify any WWW-Authenticate header fields in that response."

**Severity:** error

**Type:** test

**Applies To:** proxy

**Description:**
Proxies must not modify WWW-Authenticate header fields when forwarding responses.

**Validation Logic:**

- In test mode: Send request through proxy to origin server returning WWW-Authenticate
- Compare WWW-Authenticate header from origin with header received by client
- Detect any modifications, additions, or removals
- Report if proxy modifies WWW-Authenticate

**Test Scenarios:**

- ✓ Valid: Proxy forwards WWW-Authenticate unchanged
- ✗ Invalid: Proxy adds to WWW-Authenticate value
- ✗ Invalid: Proxy removes WWW-Authenticate header
- ✗ Invalid: Proxy changes realm or other parameters

**Implementation Notes:**

- This is a MUST NOT requirement (error severity)
- Requires test mode to validate proxy behavior
- Applies to all proxies in the chain

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## 11.6.2 Authorization

### Rule 9: Proxy Must Not Modify Authorization Header

**Rule ID:** `rfc9110/proxy-must-not-modify-authorization-header`

**Status:** 🔴 Not Started

**Priority:** P0

**RFC Section:** 11.6.2

**RFC Quote:**

> "A proxy forwarding a request MUST NOT modify any Authorization header fields in that request."

**Severity:** error

**Type:** test

**Applies To:** proxy

**Description:**
Proxies must not modify Authorization header fields when forwarding requests.

**Validation Logic:**

- In test mode: Send request with Authorization header through proxy
- Compare Authorization header sent with header received by origin
- Detect any modifications, additions, or removals
- Report if proxy modifies Authorization

**Test Scenarios:**

- ✓ Valid: Proxy forwards Authorization unchanged
- ✗ Invalid: Proxy adds to Authorization value
- ✗ Invalid: Proxy removes Authorization header
- ✗ Invalid: Proxy changes credentials or scheme

**Implementation Notes:**

- This is a MUST NOT requirement (error severity)
- Requires test mode to validate proxy behavior
- See RFC 9111 Section 3.5 for caching considerations

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## 11.6.3 Authentication-Info

### Rule 10: Proxy Must Not Modify Authentication-Info Header

**Rule ID:** `rfc9110/proxy-must-not-modify-authentication-info-header`

**Status:** 🔴 Not Started

**Priority:** P0

**RFC Section:** 11.6.3

**RFC Quote:**

> "A proxy forwarding a response is not allowed to modify the field value in any way."

**Severity:** error

**Type:** test

**Applies To:** proxy

**Description:**
Proxies must not modify Authentication-Info header fields when forwarding responses.

**Validation Logic:**

- In test mode: Send request through proxy to origin returning Authentication-Info
- Compare Authentication-Info header from origin with header received by client
- Detect any modifications, additions, or removals
- Report if proxy modifies Authentication-Info

**Test Scenarios:**

- ✓ Valid: Proxy forwards Authentication-Info unchanged
- ✗ Invalid: Proxy adds to Authentication-Info value
- ✗ Invalid: Proxy removes Authentication-Info header
- ✗ Invalid: Proxy changes any parameters

**Implementation Notes:**

- This is a MUST NOT requirement (error severity)
- Requires test mode to validate proxy behavior
- Authentication-Info can be sent as a trailer field when allowed by auth scheme

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## 11.7.2 Proxy-Authorization

### Rule 11: Proxy Must Not Forward Proxy-Authorization to Next Proxy

**Rule ID:** `rfc9110/proxy-must-consume-proxy-authorization-header`

**Status:** 🔴 Not Started

**Priority:** P0 (with caveats)

**RFC Section:** 11.7.2

**RFC Quote:**

> "Unlike Authorization, the Proxy-Authorization header field applies only to the next inbound proxy that demanded authentication using the Proxy-Authenticate header field. When multiple proxies are used in a chain, the Proxy-Authorization header field is consumed by the first inbound proxy that was expecting to receive credentials. A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request."

**Severity:** error (with exceptions)

**Type:** test

**Applies To:** proxy

**Description:**
Proxies should consume Proxy-Authorization headers intended for them and not forward them to the next proxy, unless proxies cooperatively authenticate.

**Validation Logic:**

- In test mode: Send request with Proxy-Authorization through proxy chain
- Verify first proxy consumes the header
- Check that Proxy-Authorization is not forwarded unless intentional cooperative auth
- Report unexpected forwarding

**Test Scenarios:**

- ✓ Valid: First proxy consumes Proxy-Authorization
- ✓ Valid: Proxy relays credentials in cooperative authentication setup
- ⚠ Warning: Proxy forwards Proxy-Authorization without cooperative auth mechanism
- ✗ Invalid: Proxy forwards Proxy-Authorization meant for itself

**Implementation Notes:**

- Default behavior: consume the header
- Exception: cooperative authentication between proxies (MAY relay)
- Requires understanding of proxy chain configuration
- Complex to implement without proxy-specific knowledge

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## 11.7.3 Proxy-Authentication-Info

### Rule 12: Proxy-Authentication-Info Applies to Next Outbound Client

**Rule ID:** `rfc9110/proxy-authentication-info-applies-to-next-outbound-client`

**Status:** 🔴 Not Started

**Priority:** P2

**RFC Section:** 11.7.3

**RFC Quote:**

> "However, unlike Authentication-Info, the Proxy-Authentication-Info header field applies only to the next outbound client on the response chain."

**Severity:** info

**Type:** static

**Applies To:** proxy

**Description:**
Proxy-Authentication-Info header field applies only to the next outbound client on the response chain (similar to Proxy-Authenticate).

**Validation Logic:**

- Informational rule - documents expected behavior
- In test mode: verify Proxy-Authentication-Info is consumed by immediate client
- Track usage patterns

**Test Scenarios:**

- ℹ Info: Proxy sends Proxy-Authentication-Info to immediate client
- ℹ Info: In cooperative proxy setups, appears to be forwarded (each proxy sends same value)

**Implementation Notes:**

- This is primarily informational
- Similar semantics to Proxy-Authenticate
- Proxy-Authentication-Info can be sent as trailer field when allowed by auth scheme

**Notes:**
_Add implementation notes, blockers, or progress updates here as you work on this rule._

---

## Implementation Priority Summary

### Phase 1: Critical Rules (P0) - MUST/MUST NOT Requirements

1. 🔴 **Parameter Name Uniqueness** - `authentication-parameter-name-must-occur-once-per-challenge`
2. 🔴 **401 Must Include WWW-Authenticate** - `server-must-send-www-authenticate-in-401-response`
3. 🔴 **407 Must Include Proxy-Authenticate** - `proxy-must-send-proxy-authenticate-in-407-response`
4. 🔴 **Realm Must Use Quoted-String** - `realm-parameter-must-use-quoted-string-syntax`
5. 🔴 **Proxy Must Not Modify WWW-Authenticate** - `proxy-must-not-modify-www-authenticate-header`
6. 🔴 **Proxy Must Not Modify Authorization** - `proxy-must-not-modify-authorization-header`
7. 🔴 **Proxy Must Not Modify Authentication-Info** - `proxy-must-not-modify-authentication-info-header`
8. 🔴 **Proxy Must Consume Proxy-Authorization** - `proxy-must-consume-proxy-authorization-header` (complex)

### Phase 2: High Priority Rules (P1) - SHOULD/SHOULD NOT Requirements

9. 🔴 **Server Should Send 401 for Invalid Credentials** - `origin-server-should-send-401-for-invalid-credentials`
10. 🔴 **Proxy Should Send 407 for Invalid Proxy Credentials** - `proxy-should-send-407-for-invalid-proxy-credentials`

### Phase 3: Medium Priority Rules (P2) - MAY Requirements & Recommendations

11. 🔴 **WWW-Authenticate in Non-401 Responses** - `server-may-send-www-authenticate-in-non-401-responses` (info)
12. 🔴 **Proxy-Authentication-Info Scope** - `proxy-authentication-info-applies-to-next-outbound-client` (info)

---

## Implementation Guidelines

### ⚠️ IMPORTANT: Use Thymian's Built-in Functions

**DO NOT create helper methods to solve issues that can be avoided using built-in functions.**

Thymian provides comprehensive filter functions in `@thymian/core`:

✅ **DO USE:**

- `responseHeader('header-name')` - for checking response headers
- `requestHeader('header-name')` - for checking request headers
- `statusCode(code)` - for matching status codes
- `and()`, `or()`, `not()` - for logical operations
- `authorization(isAuthorized)` - for checking authorization presence

❌ **DO NOT CREATE:**

- Wrapper functions like `hasWWWAuthenticateHeader()` - use `responseHeader('www-authenticate')` instead
- Wrapper functions like `hasAuthorizationHeader()` - use `requestHeader('authorization')` instead
- Custom filter functions that duplicate existing functionality

**Only create custom utilities for complex parsing logic** that doesn't exist in Thymian (e.g., parsing authentication challenge parameters for Rules 1 and 6).

---

### Rule Template

Use the following template for implementing each rule:

```typescript
import { statusCode, responseHeader, not } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/[rule-id]')
  .severity('[error|warning]')
  .type('[static|analytics|test]')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-[X.Y]')
  .description('[Description from RFC]')
  .appliesTo('[server|proxy|client]')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      // Filter 1: Which transactions to check
      statusCode(401),
      // Filter 2: What counts as a violation
      not(responseHeader('www-authenticate')),
    ),
  )
  .done();
```

**Key Points:**

- Use `ctx.validateCommonHttpTransactions()` for most rules
- First parameter: filter to select transactions to validate
- Second parameter: filter to identify violations
- Use built-in filters from `@thymian/core` - do NOT create wrapper functions
- Always end with `.done()`

### Testing Strategy

Testing is **not required** for rule implementation. It is only mandatory to:

1. **Verify TypeScript Validity**: Ensure all TypeScript files compile without errors
2. **Check for Build Errors**: Run the build process and ensure no errors occur

Optional testing (not mandatory):

1. **Unit Tests**: Test each rule individually with positive and negative cases
2. **Integration Tests**: Test rule interactions and edge cases
3. **Real-World Tests**: Use actual HTTP transactions from common frameworks
4. **Proxy Tests**: Special setup needed for proxy-specific rules (Rules 8-12)

### Built-in Filters (Already Available in Thymian)

**IMPORTANT:** Thymian provides comprehensive built-in filter functions. Do NOT create wrapper functions for existing functionality.

The following filters are available in `@thymian/core` and should be used as-is:

- ✅ `responseHeader('www-authenticate')` - Check for WWW-Authenticate header
- ✅ `responseHeader('proxy-authenticate')` - Check for Proxy-Authenticate header
- ✅ `requestHeader('authorization')` - Check for Authorization header
- ✅ `requestHeader('proxy-authorization')` - Check for Proxy-Authorization header
- ✅ `responseHeader('authentication-info')` - Check for Authentication-Info header
- ✅ `responseHeader('proxy-authentication-info')` - Check for Proxy-Authentication-Info header
- ✅ `statusCode(code)` - Match specific status codes
- ✅ `and()`, `or()`, `not()` - Logical operators for combining filters
- ✅ `authorization(isAuthorized)` - Check authorization presence via security schemes

### Utilities to Create (Only if Needed for Complex Validation)

The following utilities may need to be created **only for parameter validation rules** (Rules 1 and 6):

- `parseAuthenticationChallenge()` - Parse challenge structure (scheme + parameters)
- `extractAuthParameters()` - Extract auth-param name/value pairs from header
- `validateParameterUniqueness()` - Check case-insensitive parameter name uniqueness
- `isQuotedString()` - Check if realm value uses quoted-string syntax

**Note:** Most rules (10 out of 12) can be implemented using only the built-in filters listed above.

### Header Parsing Considerations

Authentication headers have complex parsing requirements:

1. **Multiple Challenges**: A single header can contain multiple challenges
2. **Comma Ambiguity**: Commas can separate challenges or parameters
3. **Multiple Headers**: Same header name can appear multiple times
4. **Case Sensitivity**: Scheme names are case-insensitive, but parameters may be case-sensitive (except realm)
5. **Quoted Strings**: Parameters can be tokens or quoted-strings

Recommend creating a dedicated authentication header parser utility.

---

## Dependencies and Prerequisites

### External Dependencies

- None specific to authentication rules beyond existing Thymian dependencies

### Internal Dependencies

- Header parsing utilities (may need enhancement)
- Status code filters (existing)
- Header presence filters (may need creation)

### Test Infrastructure

- Proxy testing infrastructure for Rules 8-12
- Mock authentication server for test mode
- Challenge/response generation utilities

---

## Validation and Verification

### Rule Coverage Checklist

- [ ] All MUST requirements implemented (P0)
- [ ] All MUST NOT requirements implemented (P0)
- [ ] All SHOULD requirements implemented (P1)
- [ ] All SHOULD NOT requirements implemented (P1)
- [ ] MAY requirements documented (P2)

### Test Coverage Goals

- **Unit Tests**: 100% of rules
- **Integration Tests**: All rule interactions
- **Edge Cases**: Complex parsing scenarios, multiple headers, proxy chains

### Documentation

Each rule should include:

- RFC section reference
- Exact RFC quote
- Clear description
- Validation logic explanation
- Test scenarios (positive and negative)
- Implementation notes

---

## Open Questions and Challenges

### Technical Challenges

1. **Authentication Parameter Parsing**: Complex parsing required for challenges with multiple auth-params (Rules 1 and 6 only)
2. **Proxy Chain Testing**: Difficult to test multi-proxy scenarios (Rules 8-11)
3. **Cooperative Authentication Detection**: Hard to distinguish intentional relay from violation (Rule 11)
4. **Invalid Credentials Detection**: Cannot reliably detect invalid vs. valid-but-insufficient credentials (Rules 4-5)

**Note:** Most rules (Rules 2, 3, 7, 12) have NO technical challenges - they use simple built-in filters.

### Design Decisions Needed

1. **Parser Approach**: Create dedicated auth header parser for Rules 1 and 6 (likely as standalone utility)
2. **Proxy Testing**: What level of proxy testing is feasible in test mode? (Rules 8-11)
3. **Informational Rules**: Should P2 informational rules be implemented as actual rules or just documentation?
4. **Credential Validation**: How to implement rules that require understanding authentication state? (Rules 4-5)

**Resolved:** No need to create custom header presence filters - use built-in `responseHeader()` and `requestHeader()` functions.

### Future Enhancements

1. **Scheme-Specific Rules**: Implement rules for specific auth schemes (Basic, Digest, Bearer)
2. **Security Recommendations**: Add rules for security best practices beyond RFC 9110 requirements
3. **Cache Interaction**: Implement rules for authentication + caching interactions (RFC 9111 Section 3.5)
4. **Advanced Analytics**: Track authentication patterns, success rates, etc.

---

## Migration Implementation Phases

Most rules require only configuration, not custom implementation, thanks to Thymian's built-in filters.

### Phase 1: Simple Rules

- Create directory structure
- Implement Rules 2-3 (401/407 header requirements) - use built-in filters
- Implement Rules 7 (WWW-Authenticate in non-401) - use built-in filters
- Implement Rule 12 (Proxy-Authentication-Info scope) - use built-in filters
- **No custom filter creation needed**

### Phase 2: Parameter Validation Rules

- Implement authentication header parser utility (for Rules 1 and 6 only)
- Implement Rule 1 (parameter uniqueness)
- Implement Rule 6 (realm quoted-string syntax)

### Phase 3: Test-Mode Rules

- Set up proxy testing infrastructure
- Implement Rules 8-10 (header forwarding rules)
- Implement Rule 11 (Proxy-Authorization consumption)

### Phase 4: Analytics Rules

- Implement Rules 4-5 (credential validation heuristics)
- Complete testing and documentation
- Code review

---

## Success Criteria

1. **Completeness**: All P0 and P1 rules implemented
2. **Correctness**: All rules correctly validate RFC 9110 requirements
3. **Test Coverage**: >90% code coverage, all scenarios tested
4. **Performance**: Rules run efficiently without significant overhead
5. **Documentation**: Clear documentation for each rule
6. **Usability**: Rules provide actionable feedback to users

---

## References

- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9110 Section 11 - HTTP Authentication](https://www.rfc-editor.org/rfc/rfc9110.html#name-http-authentication)
- [RFC 7617 - The 'Basic' HTTP Authentication Scheme](https://www.rfc-editor.org/rfc/rfc7617.html)
- [RFC 7616 - HTTP Digest Access Authentication](https://www.rfc-editor.org/rfc/rfc7616.html)
- [RFC 9111 Section 3.5 - Authorization and Caching](https://www.rfc-editor.org/rfc/rfc9111.html#section-3.5)
- [Thymian Rule Creation Guide](./CREATING_NEW_RULES.md)

---

## Appendix: Rule Implementation Examples

### Example 1: Simple Header Presence Check (Rule 2: 401 Must Include WWW-Authenticate)

```typescript
// Rule 2: server-must-send-www-authenticate-in-401-response.rule.ts
import { statusCode, responseHeader, not } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-send-www-authenticate-in-401-response')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.1')
  .description('A server generating a 401 (Unauthorized) response MUST send a WWW-Authenticate header field containing at least one challenge.')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(401), not(responseHeader('www-authenticate'))))
  .done();
```

**Explanation:**

- Uses built-in `statusCode()` and `responseHeader()` filters
- First filter: selects all 401 responses
- Second filter: identifies violations (401 responses WITHOUT www-authenticate header)
- Simple pattern - no custom utilities needed

### Example 2: Similar Rule for Proxy Authentication (Rule 3: 407 Must Include Proxy-Authenticate)

```typescript
// Rule 3: proxy-must-send-proxy-authenticate-in-407-response.rule.ts
import { statusCode, responseHeader, not } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-send-proxy-authenticate-in-407-response')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7.1')
  .description('A proxy MUST send at least one Proxy-Authenticate header field in each 407 (Proxy Authentication Required) response that it generates.')
  .appliesTo('proxy')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(407), not(responseHeader('proxy-authenticate'))))
  .done();
```

**Explanation:**

- Same pattern as Example 1, but for proxy authentication
- Uses different status code (407) and header (proxy-authenticate)
- Demonstrates consistency across authentication rules

### Example 3: Complex Parameter Validation (Rule 1 - Requires Custom Parsing)

**Note:** This rule requires custom header parsing utilities since it validates parameter structure.

```typescript
// Rule 1: authentication-parameter-name-must-occur-once-per-challenge.rule.ts
import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
// Custom utility functions needed only for this rule
import { parseAuthenticationHeader, hasDuplicateParameters } from '../utils/auth-parser';

export default httpRule('rfc9110/authentication-parameter-name-must-occur-once-per-challenge')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.2')
  .description('Each authentication parameter name MUST only occur once per challenge (case-insensitive).')
  .appliesTo('server')
  .rule((ctx) =>
    // For this complex rule, we need custom validation logic
    ctx.validateCommonHttpTransactions(responseHeader('www-authenticate'), (transaction) => {
      const wwwAuth = transaction.response.headers['www-authenticate'];
      if (!wwwAuth) return false;

      const challenges = parseAuthenticationHeader(wwwAuth);
      return challenges.some((challenge) => hasDuplicateParameters(challenge));
    }),
  )
  .done();
```

**Explanation:**

- Most rules DON'T need this complexity - use built-in filters instead
- Custom parsing only needed for Rules 1 and 6 (parameter validation)
- Still uses `responseHeader()` for initial filtering
- Custom function checks for duplicate parameter names (case-insensitive)

---

## Document Status

**Version:** 2.0 (LLM-Optimized)
**Status:** 🤖 Ready for LLM Execution
**Last Updated:** 2025-12-05
**Next Review:** After LLM completes Phase 2 (Rules 2 & 3)

---

## Changelog

- **2025-12-05 v2.0**: **LLM Execution Optimization**
  - **MAJOR RESTRUCTURE**: Reorganized entire document for LLM execution
  - Added "🤖 LLM Execution Instructions" section at top with navigation guide
  - Added "Quick Reference: All 12 Rules" summary table for quick scanning
  - Added "🚨 Common Pitfalls for LLMs" section with explicit DO/DON'T lists
  - Added "Step-by-Step Execution Guide" with 6 phases in clear order
  - Added "Rule Implementation Checklist" with checkboxes and complexity indicators
  - Reformatted all rules with:
    - "🤖 LLM Action" header indicating when to implement
    - **File** path prominently displayed
    - **Status** field with reminder to update
    - **Complete Implementation** code blocks ready to copy
    - **LLM Notes** section for tracking progress
  - Added file placement table mapping rules to directories
  - Structured for sequential execution rather than reference
  - Emphasized status indicator updates (🔴→🟡→🟢)
  - Made all critical information scannable and actionable

- **2025-12-05 v1.2**: Updated to leverage Thymian's built-in functions
  - Identified that Thymian already provides all necessary filter functions
  - Removed incorrect suggestions to create wrapper functions
  - Updated rule template to use actual working pattern
  - Reduced timeline estimate by ~50%
  - Clarified that only 2 rules need custom parsing utilities

- **2025-12-05 v1.1**: Added status tracking and notes for migration management
  - Added status indicators for tracking progress
  - Added Migration Progress Tracking section
  - Made migration resumable at any point

- **2025-12-05 v1.0**: Initial migration plan created
  - Analyzed RFC 9110 Section 11
  - Identified 12 rules across 3 priority levels
  - Defined implementation phases and timeline
