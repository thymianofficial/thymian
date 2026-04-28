---
title: 'Sensitive Data Leakage via Referer'
description: 'How Referer headers leak OAuth tokens, session identifiers, and private URLs across security boundaries'
---

When a user navigates from one page to another, the browser sends a `Referer` header containing the URL of the previous page. This seemingly innocent mechanism becomes a data leakage vector when the referring URL contains sensitive information — OAuth authorization codes in query parameters, session tokens, internal paths, or search queries that reveal private information. When navigation crosses from HTTPS to HTTP, the full URL is sent in plaintext over the network. When it crosses to a third-party domain, the URL is shared with that domain's operators.

## Why This Matters

- **OAuth authorization code theft** — OAuth redirect URIs like `https://app.example.com/callback?code=a1b2c3d4` contain authorization codes in the query string. If the callback page loads any third-party resource (analytics script, font, image), the Referer header leaks the authorization code to that third party. This is a documented attack vector in OAuth security research.
- **Token leakage in query parameters** — Password reset links (`/reset?token=secret`), email verification links, invitation links, and API keys in URLs are all leaked via Referer when the user navigates away from those pages.
- **HTTPS-to-HTTP exposure** — When a user navigates from an HTTPS page to an HTTP page, the Referer header is sent in plaintext over the network. Anyone monitoring the traffic (on public WiFi, at ISP level, or through corporate proxies) can read the referring URL and any tokens it contains.
- **Privacy violations** — Search queries (`/search?q=medical+condition`), internal admin paths (`/admin/user/42/medical-records`), and other URLs that reveal user behavior or organizational structure are shared with every external site the user visits.
- **Internal path disclosure** — URLs like `https://internal.corp.com/jira/PROJECT-1234` reveal internal tools, project names, and ticketing systems to external sites.

## How It Works

```mermaid
sequenceDiagram
    participant User
    participant App as app.example.com (HTTPS)
    participant Analytics as analytics.tracker.com
    participant HTTP as insecure.example.com (HTTP)

    Note over User: Completes OAuth login
    App->>User: Redirect to:<br/>https://app.example.com/callback?code=SECRET_AUTH_CODE

    Note over User: Page loads third-party analytics
    User->>Analytics: GET /track.js<br/>Referer: https://app.example.com/callback?code=SECRET_AUTH_CODE
    Note over Analytics: Has the OAuth code!

    Note over User: Clicks link to HTTP site
    User->>HTTP: GET /page<br/>Referer: https://app.example.com/callback?code=SECRET_AUTH_CODE
    Note over HTTP: Referer sent in PLAINTEXT<br/>Anyone on network can read it
```

The correct behavior prevents this leakage:

```mermaid
sequenceDiagram
    participant User
    participant App as app.example.com (HTTPS)
    participant HTTP as insecure.example.com (HTTP)

    Note over User: On HTTPS page with sensitive URL

    User->>HTTP: GET /page<br/>(no Referer header!)
    Note over User: RFC 9110: MUST NOT send<br/>Referer from secure to insecure
```

## HTTP Examples

**Non-compliant — Referer leaks token across security boundary:**

```http
GET /page HTTP/1.1
Host: insecure.example.com
Referer: https://app.example.com/reset-password?token=a8f3b2c1d4e5

```

A plaintext HTTP request contains a Referer header with an HTTPS password reset URL, including the reset token. The token is now visible to any network observer.

**Non-compliant — Referer contains fragment or userinfo:**

```http
GET /external-page HTTP/1.1
Host: other-site.com
Referer: https://user:pass@app.example.com/page#private-section
```

Fragments (`#private-section`) and userinfo (`user:pass@`) must never appear in Referer headers. Fragments reveal which section of a page the user was reading; userinfo leaks credentials.

**Compliant — Referer omitted for secure-to-insecure navigation:**

```http
GET /page HTTP/1.1
Host: insecure.example.com

```

No Referer header is sent when navigating from HTTPS to HTTP. The sensitive URL never leaves the encrypted channel.

**Compliant — Referer with Referrer-Policy limiting exposure:**

```http
HTTP/1.1 200 OK
Referrer-Policy: strict-origin-when-cross-origin

```

This policy sends only the origin (`https://app.example.com`) to cross-origin destinations, not the full URL with path and query string. Same-origin navigations still receive the full URL.

## How Thymian Detects This

Thymian validates Referer header safety using the following rules from the RFC 9110 rule set:

- **`user-agent-must-not-send-referer-in-unsecured-request-from-secure-resource`** — The primary security rule. When navigating from HTTPS to HTTP, the user agent MUST NOT include a Referer header. This prevents plaintext exposure of secure URLs.
- **`user-agent-should-not-send-referer-for-secure-to-insecure`** — A broader warning that covers all secure-to-insecure transitions, not just those caught by the MUST-level rule
- **`user-agent-must-not-include-fragment-or-userinfo-in-referer`** — Ensures that fragment identifiers (which reveal in-page navigation) and userinfo (which contains credentials) are never included in the Referer header
- **`user-agent-must-exclude-referer-or-send-about-blank-for-no-source`** — When there is no referring resource (e.g., user typed the URL directly), the Referer must be omitted or set to `about:blank`, not fabricated
- **`intermediary-should-not-modify-referer-for-same-scheme-and-host`** — Prevents intermediaries from altering Referer headers for same-origin requests, which could break applications that rely on Referer for CSRF protection

## Key Takeaways

- The Referer header leaks the full URL — including query parameters containing tokens, codes, and search terms — to every external resource and navigation target
- Navigating from HTTPS to HTTP sends the Referer in plaintext — this **must not** happen, as it exposes the entire URL to network observers
- OAuth authorization codes, password reset tokens, and API keys in URLs are particularly vulnerable to Referer leakage
- Use `Referrer-Policy: strict-origin-when-cross-origin` as a defense-in-depth measure to limit what information is shared in the Referer
- Avoid placing sensitive data in URLs whenever possible — use POST bodies, HTTP headers, or server-side sessions instead

## Further Reading

- [RFC 9110, Section 10.1.3 — Referer](https://www.rfc-editor.org/rfc/rfc9110#section-10.1.3) — Referer header semantics and security considerations
- [W3C — Referrer Policy](https://www.w3.org/TR/referrer-policy/) — The Referrer-Policy mechanism for controlling Referer header behavior
- [RFC 6749, Section 10.6 — OAuth Authorization Code Leakage](https://www.rfc-editor.org/rfc/rfc6749#section-10.6) — OAuth security considerations related to Referer leakage
- [OWASP — Information Exposure Through Query Strings in URL](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url) — General guidance on URL-based information leakage
