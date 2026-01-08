# RFC 9110 Section 11: HTTP Authentication - Implementation Plan

## Document Purpose

This plan provides a comprehensive roadmap for implementing HTTP authentication rules based on RFC 9110 Section 11. It is designed to be executed by an LLM following the guidelines in `CREATING_NEW_RULES.md`.

## Overview

**Section:** RFC 9110 Section 11 - HTTP Authentication
**URL:** https://www.rfc-editor.org/rfc/rfc9110.html#section-11
**Subsections:** 11.1 - 11.7

## Implementation Strategy

### Phase 1: Authentication Scheme (Section 11.1)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-scheme

#### Rules to Implement:

1. **Informational Rule: Authentication Scheme Definition**
   - **File:** `src/rules/authentication/scheme/authentication-scheme-definition.rule.ts`
   - **Identifier:** `rfc9110/authentication-scheme-definition`
   - **Type:** `informational`
   - **Severity:** N/A
   - **Description:** "HTTP provides a general framework for access control and authentication, via an extensible set of challenge-response authentication schemes."
   - **AppliesTo:** `server`, `client`
   - **Notes:** This is a foundational informational rule describing the authentication framework.

### Phase 2: Authentication Parameters (Section 11.2)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters

#### Rules to Implement:

1. **Parameter Name Uniqueness Rule**
   - **File:** `src/rules/authentication/parameters/authentication-parameter-name-must-occur-once-per-challenge.rule.ts`
   - **Identifier:** `rfc9110/authentication-parameter-name-must-occur-once-per-challenge`
   - **Type:** `static`, `analytics`
   - **Severity:** `error`
   - **RFC Requirement:** "each parameter name MUST only occur once per challenge"
   - **Description:** "Authentication parameter names are matched case-insensitively and each parameter name MUST only occur once per challenge."
   - **AppliesTo:** `server`, `proxy`
   - **Validation Pattern:** Custom function (Pattern C)
   - **Implementation Notes:**
     - Parse `WWW-Authenticate` and `Proxy-Authenticate` headers
     - Extract authentication parameters from each challenge
     - Check for duplicate parameter names (case-insensitive comparison)
     - Report violation if duplicates found within a single challenge

2. **Token and Quoted-String Support Rule**
   - **File:** `src/rules/authentication/parameters/authentication-scheme-must-accept-token-and-quoted-string.rule.ts`
   - **Identifier:** `rfc9110/authentication-scheme-must-accept-token-and-quoted-string`
   - **Type:** `informational`
   - **Severity:** `error`
   - **RFC Requirement:** "Authentication scheme definitions need to accept both notations, both for senders and recipients"
   - **Description:** "Authentication scheme definitions need to accept both token and quoted-string notations for parameter values, both for senders and recipients."
   - **AppliesTo:** `server`, `client`, `proxy`
   - **Notes:** Informational - difficult to test programmatically without scheme-specific knowledge

### Phase 3: Challenge and Response (Section 11.3)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-challenge-and-response

#### Rules to Implement:

1. **401 Response Must Include WWW-Authenticate**
   - **File:** `src/rules/authentication/challenge-response/origin-server-must-send-www-authenticate-for-401.rule.ts`
   - **Identifier:** `rfc9110/origin-server-must-send-www-authenticate-for-401`
   - **Type:** `static`, `analytics`
   - **Severity:** `error`
   - **RFC Requirement:** "A 401 (Unauthorized) response message is used by an origin server to challenge the authorization of a user agent, including a WWW-Authenticate header field containing at least one challenge applicable to the requested resource."
   - **Description:** "A server generating a 401 (Unauthorized) response MUST send a WWW-Authenticate header field containing at least one challenge."
   - **AppliesTo:** `origin server`
   - **Validation Pattern:** Pattern A (two filters)
   - **Implementation:**
     ```typescript
     .rule((ctx) =>
       ctx.validateCommonHttpTransactions(
         statusCode(401),
         not(responseHeader('www-authenticate'))
       )
     )
     ```

2. **407 Response Must Include Proxy-Authenticate**
   - **File:** `src/rules/authentication/challenge-response/proxy-must-send-proxy-authenticate-for-407.rule.ts`
   - **Identifier:** `rfc9110/proxy-must-send-proxy-authenticate-for-407`
   - **Type:** `static`, `analytics`
   - **Severity:** `error`
   - **RFC Requirement:** "A 407 (Proxy Authentication Required) response message is used by a proxy to challenge the authorization of a client, including a Proxy-Authenticate header field containing at least one challenge applicable to the proxy for the requested resource."
   - **Description:** "A proxy MUST send at least one Proxy-Authenticate header field in each 407 (Proxy Authentication Required) response that it generates."
   - **AppliesTo:** `proxy`
   - **Validation Pattern:** Pattern A (two filters)
   - **Implementation:**
     ```typescript
     .rule((ctx) =>
       ctx.validateCommonHttpTransactions(
         statusCode(407),
         not(responseHeader('proxy-authenticate'))
       )
     )
     ```

### Phase 4: Credentials (Section 11.4)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials

#### Rules to Implement:

1. **Origin Server Should Send 401 for Invalid Credentials**
   - **File:** `src/rules/authentication/credentials/origin-server-should-send-401-for-invalid-credentials.rule.ts`
   - **Identifier:** `rfc9110/origin-server-should-send-401-for-invalid-credentials`
   - **Type:** `informational`
   - **Severity:** `warn`
   - **RFC Requirement:** "Upon receipt of a request for a protected resource that omits credentials, contains invalid credentials (e.g., a bad password) or partial credentials (e.g., when the authentication scheme requires more than one round trip), an origin server SHOULD send a 401 (Unauthorized) response that contains a WWW-Authenticate header field with at least one (possibly new) challenge applicable to the requested resource."
   - **Description:** "Upon receipt of a request for a protected resource that omits credentials, contains invalid credentials, or partial credentials, an origin server SHOULD send a 401 (Unauthorized) response that contains a WWW-Authenticate header field."
   - **AppliesTo:** `origin server`
   - **Notes:** Marked as informational because determining if credentials are "invalid" or "partial" requires authentication context

2. **Proxy Should Send 407 for Invalid Proxy Credentials**
   - **File:** `src/rules/authentication/credentials/proxy-should-send-407-for-invalid-proxy-credentials.rule.ts`
   - **Identifier:** `rfc9110/proxy-should-send-407-for-invalid-proxy-credentials`
   - **Type:** `informational`
   - **Severity:** `warn`
   - **RFC Requirement:** "Likewise, upon receipt of a request that omits proxy credentials or contains invalid or partial proxy credentials, a proxy that requires authentication SHOULD generate a 407 (Proxy Authentication Required) response that contains a Proxy-Authenticate header field with at least one (possibly new) challenge applicable to the proxy."
   - **Description:** "Upon receipt of a request that omits proxy credentials or contains invalid or partial proxy credentials, a proxy that requires authentication SHOULD generate a 407 (Proxy Authentication Required) response with a Proxy-Authenticate header field."
   - **AppliesTo:** `proxy`
   - **Notes:** Marked as informational because determining credential validity requires authentication context

3. **Server Should Send 403 for Valid but Inadequate Credentials**
   - **File:** `src/rules/authentication/credentials/server-should-send-403-for-inadequate-credentials.rule.ts`
   - **Identifier:** `rfc9110/server-should-send-403-for-inadequate-credentials`
   - **Type:** `informational`
   - **Severity:** `hint`
   - **RFC Requirement:** "A server that receives valid credentials that are not adequate to gain access ought to respond with the 403 (Forbidden) status code"
   - **Description:** "A server that receives valid credentials that are not adequate to gain access ought to respond with the 403 (Forbidden) status code."
   - **AppliesTo:** `server`
   - **Notes:** Uses "ought" - softer than SHOULD; informational because determining credential adequacy requires application context

### Phase 5: Protection Space (Realm) (Section 11.5)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s

#### Rules to Implement:

1. **Realm Parameter Must Use Quoted-String Syntax**
   - **File:** `src/rules/authentication/realm/realm-parameter-must-use-quoted-string-syntax.rule.ts`
   - **Identifier:** `rfc9110/realm-parameter-must-use-quoted-string-syntax`
   - **Type:** `static`, `analytics`
   - **Severity:** `error`
   - **RFC Requirement:** "For historical reasons, a sender MUST only generate the quoted-string syntax."
   - **Description:** "For historical reasons, a sender MUST only generate the quoted-string syntax for realm parameter values."
   - **AppliesTo:** `server`, `proxy`
   - **Validation Pattern:** Custom function (Pattern C)
   - **Implementation Notes:**
     - Parse `WWW-Authenticate` and `Proxy-Authenticate` headers
     - Extract realm parameter from challenges
     - Verify realm value uses quoted-string syntax (surrounded by quotes)
     - Report violation if token syntax is used instead

2. **Protection Space Cannot Extend Beyond Origin**
   - **File:** `src/rules/authentication/realm/protection-space-cannot-extend-beyond-origin.rule.ts`
   - **Identifier:** `rfc9110/protection-space-cannot-extend-beyond-origin`
   - **Type:** `informational`
   - **Severity:** `error`
   - **RFC Requirement:** "Unless specifically allowed by the authentication scheme, a single protection space cannot extend outside the scope of its server."
   - **Description:** "Unless specifically allowed by the authentication scheme, a single protection space cannot extend outside the scope of its server."
   - **AppliesTo:** `server`
   - **Notes:** Informational - requires tracking credentials across origins and scheme-specific knowledge

### Phase 6: WWW-Authenticate, Authorization, Authentication-Info (Section 11.6)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori

#### Rules to Implement:

1. **Server May Send WWW-Authenticate in Other Responses**
   - **File:** `src/rules/authentication/origin-server/www-authenticate/server-may-send-www-authenticate-in-other-responses.rule.ts`
   - **Identifier:** `rfc9110/server-may-send-www-authenticate-in-other-responses`
   - **Type:** `informational`
   - **Severity:** `hint`
   - **RFC Requirement:** "A server MAY generate a WWW-Authenticate header field in other response messages to indicate that supplying credentials (or different credentials) might affect the response."
   - **Description:** "A server MAY generate a WWW-Authenticate header field in other response messages to indicate that supplying credentials (or different credentials) might affect the response."
   - **AppliesTo:** `server`
   - **Notes:** Informational - documents optional behavior

2. **Proxy Must Not Modify WWW-Authenticate Header**
   - **File:** `src/rules/authentication/origin-server/www-authenticate/proxy-must-not-modify-www-authenticate.rule.ts`
   - **Identifier:** `rfc9110/proxy-must-not-modify-www-authenticate`
   - **Type:** `informational`
   - **Severity:** `error`
   - **RFC Requirement:** "A proxy forwarding a response MUST NOT modify any WWW-Authenticate header fields in that response."
   - **Description:** "A proxy forwarding a response MUST NOT modify any WWW-Authenticate header fields in that response."
   - **AppliesTo:** `proxy`
   - **Notes:** Informational - cannot be validated without comparing proxy input/output

3. **Proxy Must Not Modify Authorization Header**
   - **File:** `src/rules/authentication/origin-server/authorization/proxy-must-not-modify-authorization.rule.ts`
   - **Identifier:** `rfc9110/proxy-must-not-modify-authorization`
   - **Type:** `informational`
   - **Severity:** `error`
   - **RFC Requirement:** "A proxy forwarding a request MUST NOT modify any Authorization header fields in that request."
   - **Description:** "A proxy forwarding a request MUST NOT modify any Authorization header fields in that request."
   - **AppliesTo:** `proxy`
   - **Notes:** Informational - cannot be validated without comparing proxy input/output

4. **Proxy Must Not Modify Authentication-Info Header**
   - **File:** `src/rules/authentication/origin-server/authentication-info/proxy-must-not-modify-authentication-info.rule.ts`
   - **Identifier:** `rfc9110/proxy-must-not-modify-authentication-info`
   - **Type:** `informational`
   - **Severity:** `error`
   - **RFC Requirement:** "A proxy forwarding a response is not allowed to modify the field value in any way."
   - **Description:** "A proxy forwarding a response is not allowed to modify the Authentication-Info field value in any way."
   - **AppliesTo:** `proxy`
   - **Notes:** Informational - cannot be validated without comparing proxy input/output

### Phase 7: Proxy-Authenticate, Proxy-Authorization, Proxy-Authentication-Info (Section 11.7)

**Section URL:** https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p

#### Rules to Implement:

1. **Proxy-Authenticate Applies Only to Next Outbound Client**
   - **File:** `src/rules/authentication/proxy/proxy-authenticate/proxy-authenticate-applies-to-next-client.rule.ts`
   - **Identifier:** `rfc9110/proxy-authenticate-applies-to-next-client`
   - **Type:** `informational`
   - **Severity:** N/A
   - **RFC Statement:** "Unlike WWW-Authenticate, the Proxy-Authenticate header field applies only to the next outbound client on the response chain."
   - **Description:** "Unlike WWW-Authenticate, the Proxy-Authenticate header field applies only to the next outbound client on the response chain."
   - **AppliesTo:** `proxy`
   - **Notes:** Informational - describes proxy behavior characteristic

2. **Proxy-Authorization Applies Only to Next Inbound Proxy**
   - **File:** `src/rules/authentication/proxy/proxy-authorization/proxy-authorization-applies-to-next-proxy.rule.ts`
   - **Identifier:** `rfc9110/proxy-authorization-applies-to-next-proxy`
   - **Type:** `informational`
   - **Severity:** N/A
   - **RFC Statement:** "Unlike Authorization, the Proxy-Authorization header field applies only to the next inbound proxy that demanded authentication using the Proxy-Authenticate header field."
   - **Description:** "Unlike Authorization, the Proxy-Authorization header field applies only to the next inbound proxy that demanded authentication using the Proxy-Authenticate header field."
   - **AppliesTo:** `client`
   - **Notes:** Informational - describes client behavior characteristic

3. **Proxy May Relay Credentials**
   - **File:** `src/rules/authentication/proxy/proxy-authorization/proxy-may-relay-credentials.rule.ts`
   - **Identifier:** `rfc9110/proxy-may-relay-credentials`
   - **Type:** `informational`
   - **Severity:** `hint`
   - **RFC Statement:** "A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request."
   - **Description:** "A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request."
   - **AppliesTo:** `proxy`
   - **Notes:** Informational - documents optional proxy behavior

4. **Proxy-Authentication-Info Applies Only to Next Outbound Client**
   - **File:** `src/rules/authentication/proxy/proxy-authentication-info/proxy-authentication-info-applies-to-next-client.rule.ts`
   - **Identifier:** `rfc9110/proxy-authentication-info-applies-to-next-client`
   - **Type:** `informational`
   - **Severity:** N/A
   - **RFC Statement:** "Unlike Authentication-Info, the Proxy-Authentication-Info header field applies only to the next outbound client on the response chain."
   - **Description:** "The Proxy-Authentication-Info header field applies only to the next outbound client on the response chain."
   - **AppliesTo:** `proxy`
   - **Notes:** Informational - describes proxy behavior characteristic

## Implementation Summary

### Total Rules: 17

#### By Type:

- **Validatable Rules (static/analytics/test):** 4
- **Informational Rules:** 13

#### By Severity:

- **Error (MUST/MUST NOT):** 9
- **Warning (SHOULD/SHOULD NOT):** 2
- **Hint (MAY/OUGHT):** 3
- **Informational (N/A):** 3

#### By Phase:

1. **Phase 1 (Authentication Scheme):** 1 rule
2. **Phase 2 (Authentication Parameters):** 2 rules
3. **Phase 3 (Challenge and Response):** 2 rules
4. **Phase 4 (Credentials):** 3 rules
5. **Phase 5 (Protection Space/Realm):** 2 rules
6. **Phase 6 (Origin Server Authentication):** 4 rules
7. **Phase 7 (Proxy Authentication):** 4 rules

## Directory Structure

```
src/rules/authentication/
├── scheme/
│   └── authentication-scheme-definition.rule.ts
├── parameters/
│   ├── authentication-parameter-name-must-occur-once-per-challenge.rule.ts
│   └── authentication-scheme-must-accept-token-and-quoted-string.rule.ts
├── challenge-response/
│   ├── origin-server-must-send-www-authenticate-for-401.rule.ts
│   └── proxy-must-send-proxy-authenticate-for-407.rule.ts
├── credentials/
│   ├── origin-server-should-send-401-for-invalid-credentials.rule.ts
│   ├── proxy-should-send-407-for-invalid-proxy-credentials.rule.ts
│   └── server-should-send-403-for-inadequate-credentials.rule.ts
├── realm/
│   ├── realm-parameter-must-use-quoted-string-syntax.rule.ts
│   └── protection-space-cannot-extend-beyond-origin.rule.ts
├── origin-server/
│   ├── www-authenticate/
│   │   ├── server-may-send-www-authenticate-in-other-responses.rule.ts
│   │   └── proxy-must-not-modify-www-authenticate.rule.ts
│   ├── authorization/
│   │   └── proxy-must-not-modify-authorization.rule.ts
│   └── authentication-info/
│       └── proxy-must-not-modify-authentication-info.rule.ts
└── proxy/
    ├── proxy-authenticate/
    │   └── proxy-authenticate-applies-to-next-client.rule.ts
    ├── proxy-authorization/
    │   ├── proxy-authorization-applies-to-next-proxy.rule.ts
    │   └── proxy-may-relay-credentials.rule.ts
    └── proxy-authentication-info/
        └── proxy-authentication-info-applies-to-next-client.rule.ts
```

## Implementation Notes for LLM

### Critical Considerations

1. **Header Parsing:** Many authentication rules require parsing `WWW-Authenticate` and `Proxy-Authenticate` headers. Consider creating a shared utility module:
   - `src/rules/authentication/utils/auth-parser.ts`
   - Functions for parsing challenges, extracting parameters, handling quoted-strings

2. **Case-Insensitive Matching:** Authentication parameter names are case-insensitive. Use `equalsIgnoreCase` from `@thymian/core`.

3. **Quoted-String Validation:** Realm parameter validation requires checking if value is in quoted-string format vs token format.

4. **Informational Rules:** Many rules are marked as informational because they:
   - Require proxy input/output comparison (modification rules)
   - Need authentication context (credential validity)
   - Are scheme-specific (parameter format requirements)
   - Describe behavioral characteristics (scope rules)

5. **Priority Rules to Implement First:**
   - Phase 3: 401/407 header requirements (most common and testable)
   - Phase 2: Parameter uniqueness (common error)
   - Phase 5: Realm quoted-string syntax (common interoperability issue)

### Testing Strategy

For validatable rules:

1. Test with common authentication schemes (Basic, Bearer)
2. Test missing required headers (401 without WWW-Authenticate)
3. Test duplicate parameters in challenges
4. Test realm parameter format (token vs quoted-string)

### Dependencies

- `@thymian/core` - filters, utilities
- `@thymian/http-linter` - rule builder
- Custom auth parsing utilities (to be created)

### Recommended Implementation Order

1. **Start with:** Phase 3 rules (401/407 header requirements) - straightforward, high value
2. **Next:** Create auth-parser utility module
3. **Then:** Phase 2 (parameter uniqueness) - requires parser
4. **Then:** Phase 5 (realm quoted-string) - requires parser
5. **Finally:** Document remaining informational rules

## Validation Checklist

For each rule implemented, verify:

- [ ] Unique identifier following `rfc9110/descriptive-name` format
- [ ] Correct severity based on RFC language (MUST=error, SHOULD=warn, MAY=hint)
- [ ] Appropriate type(s) selected (static/analytics/test/informational)
- [ ] URL reference to specific RFC 9110 section
- [ ] Description uses exact RFC text where possible
- [ ] `appliesTo` specifies correct participant(s)
- [ ] File location matches directory structure plan
- [ ] File name follows kebab-case convention with `.rule.ts` extension
- [ ] Rule logic uses appropriate validation pattern
- [ ] `.done()` called at the end
- [ ] No false positives in validation logic

## Success Criteria

Implementation is complete when:

1. All 17 rules are implemented as `.rule.ts` files
2. Directory structure matches the plan
3. All validatable rules (4) have working validation logic
4. All informational rules (13) are documented
5. Authentication parser utility is created (if needed)
6. Rules follow patterns in `CREATING_NEW_RULES.md`
7. Each rule has appropriate metadata and RFC references

## References

- **RFC 9110 Section 11:** https://www.rfc-editor.org/rfc/rfc9110.html#section-11
- **Rule Creation Guide:** `packages/rfc-9110-rules/docs/CREATING_NEW_RULES.md`
- **Existing Rules:** `packages/rfc-9110-rules/src/rules/` (for pattern reference)

---

_Plan Created: 2025-12-16_
_Based on: RFC 9110 (June 2022), Section 11 - HTTP Authentication_
