---
title: 'Proxy Authentication Header Tampering'
description: 'How proxies that strip or modify authentication headers cause authorization bypass and credential leakage'
---

HTTP authentication relies on a chain of trust: the client sends credentials in the `Authorization` header, and the server validates them. When a proxy sits between client and server — an API gateway, corporate proxy, CDN, or reverse proxy — it must forward authentication headers without modification. If a proxy strips, modifies, or caches these headers, the entire authentication flow breaks. The server may fall through to an unauthenticated code path, a cached authenticated response may be served to an unauthenticated user, or a truncated token may cause silent authentication failures that are extremely difficult to debug.

## Why This Matters

- **Authentication bypass** — A proxy strips the `Authorization` header before forwarding to the backend. The backend has no credentials to validate and either rejects the request (causing mysterious 401 errors) or, worse, falls through to a default "anonymous" code path that grants access without authentication.
- **Credential leakage through caching** — A proxy caches a response to an authenticated request (including the user's personal data) and serves it to subsequent unauthenticated users. This has caused real data breaches.
- **Token corruption** — A proxy truncates or re-encodes a Bearer token (e.g., by stripping special characters or applying URL encoding), causing the token to become invalid. The authentication failure appears as a 401 or 403 with no obvious cause.
- **Challenge corruption** — A proxy modifies the `WWW-Authenticate` header in the server's response, breaking the authentication negotiation. The client receives an authentication challenge it cannot parse or respond to.

These issues are particularly insidious because the proxy is usually transparent to the developer. The client sends correct credentials, the server expects correct credentials, but the invisible intermediary corrupts the exchange.

## How It Works

```mermaid
sequenceDiagram
    participant Client
    participant Proxy as Corporate Proxy
    participant Server as API Server

    Client->>Proxy: GET /api/account<br/>Authorization: Bearer eyJhbGciOi...
    Note over Proxy: Proxy strips Authorization<br/>header (misconfigured)
    Proxy->>Server: GET /api/account<br/>(no Authorization header!)

    alt Server requires auth
        Server->>Proxy: 401 Unauthorized<br/>WWW-Authenticate: Bearer
        Note over Proxy: Proxy modifies<br/>WWW-Authenticate header
        Proxy->>Client: 401 Unauthorized<br/>WWW-Authenticate: Basic realm="proxy"
        Note over Client: Receives wrong auth scheme!<br/>Cannot negotiate correctly.
    else Server has anonymous fallback
        Server->>Proxy: 200 OK<br/>{"user": "anonymous", "role": "guest"}
        Proxy->>Client: 200 OK
        Note over Client: Gets response but with<br/>wrong permissions
    end
```

The credential leakage scenario through caching is equally dangerous:

```mermaid
sequenceDiagram
    participant Alice
    participant Cache as CDN / Proxy Cache
    participant Server as API Server
    participant Bob

    Alice->>Cache: GET /api/profile<br/>Authorization: Bearer alice-token
    Cache->>Server: GET /api/profile<br/>Authorization: Bearer alice-token
    Server->>Cache: 200 OK<br/>{"name": "Alice", "email": "alice@example.com"}<br/>(Missing: Vary: Authorization)
    Cache->>Alice: 200 OK (Alice's profile)
    Note over Cache: Caches response without<br/>considering Authorization

    Bob->>Cache: GET /api/profile<br/>Authorization: Bearer bob-token
    Cache->>Bob: 200 OK (Alice's profile!)
    Note over Bob: Receives Alice's personal data
```

## HTTP Examples

**Non-compliant — proxy strips Authorization:**

```http
# Client sends:
GET /api/user/settings HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

# Proxy forwards (stripped):
GET /api/user/settings HTTP/1.1
Host: api.example.com
X-Forwarded-For: 192.168.1.100
```

The `Authorization` header is gone. The server has no way to authenticate the request.

**Non-compliant — proxy modifies WWW-Authenticate:**

```http
# Server sends:
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="api", error="invalid_token"

# Proxy forwards (modified):
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="Proxy Authentication Required"
```

The proxy has replaced the Bearer challenge with its own Basic challenge. The client will attempt Basic authentication against the wrong system.

**Compliant — proxy forwards authentication headers unmodified:**

```http
# Client sends:
GET /api/user/settings HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

# Proxy forwards (intact):
GET /api/user/settings HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Via: 1.1 proxy.internal
```

The `Authorization` header is forwarded byte-for-byte. The proxy adds its own `Via` header but does not touch authentication.

## How Thymian Detects This

Thymian validates authentication header integrity using the following rules from the RFC 9110 rule set:

- **`proxy-must-not-modify-authorization`** — Flags proxies that alter the `Authorization` header in any way. RFC 9110 is explicit: proxies MUST NOT modify this header.
- **`proxy-must-not-modify-www-authenticate`** — Ensures proxies forward the server's `WWW-Authenticate` challenge unmodified, preserving the authentication scheme and parameters the client needs to respond correctly
- **`proxy-must-not-modify-authentication-info`** — Protects the `Authentication-Info` header, which carries mutual authentication data that the client uses to verify the server's identity
- **`proxy-authenticate-applies-to-next-client`** — Validates that `Proxy-Authenticate` challenges are correctly scoped to the proxy-client relationship, not forwarded end-to-end
- **`proxy-may-relay-credentials`** — Validates correct credential relay behavior when proxies participate in multi-hop authentication
- **`authentication-parameter-name-must-occur-once-per-challenge`** — Catches malformed authentication challenges where parameter names are duplicated, which can cause parsing ambiguity
- **`authentication-scheme-must-accept-token-and-quoted-string`** — Ensures authentication schemes correctly handle both token and quoted-string parameter formats
- **`server-may-send-www-authenticate-in-other-responses`** — Validates that servers can include `WWW-Authenticate` in non-401 responses for proactive authentication hints

## Key Takeaways

- Proxies **must not** modify `Authorization`, `WWW-Authenticate`, or `Authentication-Info` headers — any modification breaks the authentication flow
- Authentication bypass via header stripping is a real attack vector, not just a configuration bug
- Caching authenticated responses without `Vary: Authorization` causes credential leakage between users
- Debugging proxy-induced authentication failures is notoriously difficult because the proxy is typically invisible to both client and server developers
- Always verify that every intermediary in your request path (CDN, API gateway, load balancer, reverse proxy) correctly forwards authentication headers

## Further Reading

- [RFC 9110, Section 11.6.2 — Authorization](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2) — Proxy requirements for the Authorization header
- [RFC 9110, Section 11.7.1 — WWW-Authenticate](https://www.rfc-editor.org/rfc/rfc9110#section-11.7.1) — Authentication challenge semantics
- [RFC 9110, Section 11.6.3 — Authentication-Info](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.3) — Mutual authentication data
- [RFC 9110, Section 11.7.2 — Proxy-Authenticate](https://www.rfc-editor.org/rfc/rfc9110#section-11.7.2) — Proxy-level authentication challenges
- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — General authentication best practices
