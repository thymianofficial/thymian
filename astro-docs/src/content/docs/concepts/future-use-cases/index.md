---
title: 'Future Use Cases'
description: 'Attack vectors and scenarios that require dedicated rule sets beyond RFC 9110 conformance'
---

RFC 9110 conformance catches a broad range of real-world problems, but some attack vectors operate at layers or intersections that a single-specification conformance check cannot fully address. These attacks exploit protocol translation gaps, application-level behavior, or cross-specification interactions that require dedicated rule sets.

This section documents these attack vectors for educational purposes. Each page explains the attack mechanics, why RFC 9110 conformance alone is insufficient, and what kind of rules would be needed. **These rule sets are planned but not yet implemented.**

## Planned Rule Sets

| Planned Rule Package       | Attack Vectors                                                                                                | Priority |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `rules-http-smuggling`     | [CL/TE Desync Smuggling](./http-request-smuggling-clte/)                                                      | Critical |
| `rules-h2-security`        | [H2/H1 Downgrade Smuggling](./h2-to-h1-downgrade-smuggling/), [HTTP/2 Rapid Reset DoS](./h2-rapid-reset-dos/) | Critical |
| `rules-cache-security`     | [Web Cache Poisoning](./web-cache-poisoning/), [Cache Poisoned DoS](./cache-poisoned-dos/)                    | Critical |
| `rules-host-security`      | [Host Header Attacks](./host-header-attacks/)                                                                 | High     |
| `rules-ssrf-prevention`    | [SSRF via HTTP Redirects](./ssrf-via-redirects/)                                                              | High     |
| `rules-dos-prevention`     | [Slow HTTP Attacks](./slow-http-attacks/)                                                                     | Medium   |
| `rules-websocket-security` | [WebSocket Hijacking and Smuggling](./websocket-hijacking/)                                                   | Medium   |

## Relationship to RFC 9110 Rules

Many of these attack vectors partially overlap with RFC 9110 conformance. For example:

- **Content-Length validation rules** from RFC 9110 catch some smuggling patterns, but not CL/TE desync across intermediaries
- **Header character validation rules** catch some injection vectors, but not application-level reflection of user input
- **Host header presence rules** require the Host header, but do not prevent application-level misuse of its value

The planned rule sets build on the RFC 9110 foundation to provide deeper, attack-specific detection that goes beyond single-message conformance checking.

## See Also

- [Use Cases Covered by RFC 9110](../use-cases/) — Problems that Thymian already detects through RFC 9110 conformance validation
