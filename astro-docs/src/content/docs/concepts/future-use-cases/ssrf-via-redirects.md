---
title: 'SSRF via HTTP Redirects'
description: 'How server-side request forgery exploits HTTP redirects to bypass access controls and reach internal services'
---

> **Planned** — This use case requires a dedicated `rules-ssrf-prevention` rule set that is not yet implemented.

Server-Side Request Forgery (SSRF) occurs when an attacker tricks a server-side application into making HTTP requests to unintended destinations — typically internal services, cloud metadata endpoints, or other protected resources. HTTP redirects make SSRF dramatically harder to defend against: even if an application validates the initial URL against an allowlist, a redirect from the allowed host can point to an internal resource, bypassing all checks.

## Why RFC 9110 Alone Is Insufficient

RFC 9110 defines redirect semantics (3xx status codes) but intentionally does not restrict which URLs a client should follow. The protocol is designed for interoperability across the open internet. SSRF prevention requires _application-level_ restrictions on redirect targets — something no protocol spec can or should mandate.

## How It Works

```mermaid
sequenceDiagram
    participant Attacker
    participant App as Vulnerable Application
    participant Allowed as allowed.com
    participant Cloud as 169.254.169.254 (Cloud Metadata)

    Attacker->>App: POST /fetch<br/>{"url": "https://allowed.com/redirect"}
    Note over App: Validates URL:<br/>allowed.com is on allowlist ✓
    App->>Allowed: GET /redirect
    Allowed->>App: 302 Found<br/>Location: http://169.254.169.254/latest/meta-data/
    Note over App: Follows redirect without<br/>re-validating destination
    App->>Cloud: GET /latest/meta-data/
    Cloud->>App: IAM credentials, tokens, secrets
    App->>Attacker: Returns cloud metadata
    Note over Attacker: Has AWS/GCP/Azure credentials!
```

The 2019 Capital One data breach — one of the largest in US history, exposing 100+ million customer records — exploited SSRF to access AWS metadata credentials.

## Rules That Would Be Needed

A `rules-ssrf-prevention` package would need to detect:

- Redirects targeting private/reserved IP ranges (RFC 1918, link-local, loopback)
- Redirects to cloud metadata endpoints (169.254.169.254, fd00::, etc.)
- Redirect chains exceeding a maximum depth
- Protocol downgrades in redirects (HTTPS to HTTP)
- Redirects to non-HTTP schemes (file://, gopher://, dict://)
- DNS rebinding: resolved IP re-validation after redirect

## Further Reading

- Orange Tsai, ["A New Era of SSRF"](https://www.blackhat.com/docs/us-17/thursday/us-17-Tsai-A-New-Era-Of-SSRF-Exploiting-URL-Parser-In-Trending-Programming-Languages.pdf) (Black Hat USA 2017) — URL parsing exploitation for SSRF
- [Capital One Data Breach Analysis](https://krebsonsecurity.com/2019/07/capital-one-data-theft-impacts-106m-people/) — SSRF exploitation of AWS metadata in the wild
- [OWASP — Server-Side Request Forgery](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery) — Overview and prevention
