---
title: 'Use Cases'
description: 'Real-world problems that Thymian detects through HTTP conformance validation'
---

HTTP conformance is not an abstract exercise. Every rule in the RFC 9110 specification exists because real systems broke, real data was lost, or real attacks succeeded. This section documents the concrete, real-world problems that Thymian catches by validating HTTP traffic against RFC 9110.

## What You Will Find Here

Each use case explains a specific class of problems that occur when HTTP implementations deviate from the standard. Every page includes:

- A plain-language explanation of the problem and why it matters
- Real-world incidents and consequences
- HTTP request and response examples showing both the problem and the correct behavior
- Flow diagrams illustrating how the problem manifests across clients, proxies, and servers
- The specific Thymian rules that detect the issue
- References to RFCs and academic research for further reading

## Use Cases Covered by RFC 9110 Rules

### Security

| Use Case                                                                        | Problem                                                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Request Smuggling via Content-Length](./request-smuggling-via-content-length/) | Mismatched Content-Length values cause proxies and servers to disagree on message boundaries |
| [Header Injection Attacks](./header-injection-attacks/)                         | Invalid characters in header values enable CRLF injection and response splitting             |
| [Credential Theft via Userinfo in URIs](./credential-theft-via-userinfo-uris/)  | Deprecated userinfo component in URIs enables phishing and credential leakage                |
| [TLS Certificate Validation Bypass](./tls-certificate-validation-bypass/)       | Broken certificate validation in non-browser clients enables man-in-the-middle attacks       |
| [Proxy Authentication Header Tampering](./proxy-authentication-bypass/)         | Proxies stripping or modifying authentication headers cause authorization bypass             |
| [TRACE Method Exploitation](./trace-method-exploitation/)                       | TRACE reflects sensitive headers back to attackers, enabling cross-site tracing              |
| [Sensitive Data Leakage via Referer](./sensitive-data-via-referer/)             | Referer headers leak tokens, OAuth codes, and private URLs across security boundaries        |

### Data Integrity

| Use Case                                                                                | Problem                                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Duplicate Operations from Unsafe Retries](./duplicate-operations-from-unsafe-retries/) | Proxies retrying non-idempotent requests cause double charges and duplicate records   |
| [Lost Update Problem](./lost-update-problem/)                                           | Missing conditional requests allow concurrent writes to silently overwrite each other |
| [Proxy Content Corruption](./proxy-content-corruption/)                                 | Intermediaries transforming response bodies corrupt API payloads and break checksums  |
| [Redirect Method Confusion](./redirect-method-confusion/)                               | Wrong redirect status codes cause POST bodies to be silently dropped                  |

### Availability

| Use Case                                                        | Problem                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Forwarding Loops](./forwarding-loops/)                         | Misconfigured proxies create infinite request loops that exhaust all connections  |
| [100-Continue Deadlock](./100-continue-deadlock/)               | Client and server each wait for the other, causing timeouts on large uploads      |
| [Oversized Headers Denial of Service](./oversized-headers-dos/) | Missing header size limits enable memory exhaustion or break authentication flows |

### Interoperability

| Use Case                                                                        | Problem                                                                                        |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Content Negotiation Failures](./content-negotiation-failures/)                 | Wrong encoding, language, or content type produce garbled or unreadable responses              |
| [Cache Poisoning via Missing Vary Headers](./cache-poisoning-via-missing-vary/) | Missing Vary headers cause caches to serve the wrong content to users                          |
| [Safe Method Side Effects](./safe-method-side-effects/)                         | GET endpoints with side effects break when crawlers, prefetchers, or caches interact with them |
| [Hop-by-Hop Header Leakage](./hop-by-hop-header-leakage/)                       | Proxies forwarding connection-specific headers corrupt connection management                   |

### Information Disclosure

| Use Case                                                                                | Problem                                                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Server and Client Fingerprinting](./server-and-client-fingerprinting/)                 | Detailed Server and User-Agent headers reveal exact software versions to attackers |
| [Internal Topology Disclosure via Via Headers](./internal-topology-disclosure-via-via/) | Via headers expose internal hostnames and network architecture                     |

## Beyond RFC 9110

Some attack vectors require dedicated rule sets that go beyond RFC 9110 conformance. These are documented separately in [Future Use Cases](../future-use-cases/).
