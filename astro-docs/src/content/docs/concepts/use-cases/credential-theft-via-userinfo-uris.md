---
title: 'Credential Theft via Userinfo in URIs'
description: 'How the deprecated userinfo component in HTTP URIs enables phishing, credential leakage, and SSRF attacks'
---

HTTP URIs support an optional "userinfo" component — the `username:password@` part before the hostname. This feature was deprecated because it creates a class of attacks where URIs look like they point to a trusted domain but actually redirect to a malicious one. A URI like `http://trusted-bank.com@evil.com/login` does not go to `trusted-bank.com` — it goes to `evil.com` with `trusted-bank.com` as the username. Despite being deprecated for over a decade, many HTTP clients still accept these URIs, enabling phishing, credential leakage, and server-side request forgery.

## Why This Matters

- **Phishing** — Attackers craft URIs that display a trusted hostname before the `@` symbol, tricking users into visiting malicious sites. Early versions of Internet Explorer displayed only the text before `@` in the address bar, making `http://www.paypal.com@evil.com` appear as a legitimate PayPal URL.
- **Credential leakage in logs** — When applications log or forward URIs containing userinfo, plaintext credentials appear in log files, monitoring dashboards, and error reports. These credentials are then exposed to anyone with log access.
- **SSRF exploitation** — Orange Tsai's 2017 Black Hat research "A New Era of SSRF" demonstrated that URL parsing inconsistencies in the userinfo component allow attackers to bypass SSRF protections. Different URL parsers interpret `http://trusted.com@evil.com` differently — some see the host as `trusted.com`, others as `evil.com`.
- **Authentication confusion** — Some HTTP clients silently extract the userinfo and send it as HTTP Basic Authentication credentials, creating unexpected authentication flows.

## How It Works

The URI syntax defined in RFC 3986 allows a `userinfo` component in the authority:

```
http://username:password@hostname:port/path
       └──── userinfo ────┘└── host ──┘
```

The problem is that `username:password` is visually ambiguous. Humans read left to right and see the text before `@` as the hostname. Machines parse the `@` as a delimiter and use the text after it as the actual host.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant DNS

    Note over User: Receives link:<br/>http://mybank.com@evil.com/login

    User->>Browser: Clicks link
    Note over Browser: Parses URI:<br/>userinfo = "mybank.com"<br/>host = "evil.com"<br/>path = "/login"
    Browser->>DNS: Resolve evil.com
    DNS->>Browser: 93.184.216.34
    Browser->>Browser: Connects to evil.com
    Note over Browser: User sees a fake login page<br/>hosted on evil.com
```

The SSRF variant is more dangerous because it happens server-side:

```mermaid
sequenceDiagram
    participant Attacker
    participant App as Web Application
    participant Internal as Internal Service

    Attacker->>App: POST /api/fetch-url<br/>{"url": "http://allowed.com@169.254.169.254/metadata"}
    Note over App: URL allowlist check:<br/>Parser A sees host = "allowed.com" (allowed)<br/>Parser B sees host = "169.254.169.254"
    App->>Internal: GET /metadata
    Internal->>App: AWS credentials, tokens, etc.
    App->>Attacker: Returns internal metadata
```

## HTTP Examples

**Non-compliant — URI with userinfo:**

```http
GET http://admin:s3cret@api.example.com/users HTTP/1.1
Host: api.example.com
```

This request embeds credentials directly in the URI. These credentials will appear in:

- Proxy access logs
- Browser history
- Referer headers sent to other sites
- Network monitoring tools
- Any intermediary that logs the request line

**Non-compliant — URI with deceptive userinfo:**

```http
GET http://trusted-site.com@evil.com/steal HTTP/1.1
Host: evil.com
```

The actual request goes to `evil.com`. The `trusted-site.com` part is just the username sent in the authority.

**Compliant — URI without userinfo:**

```http
GET /users HTTP/1.1
Host: api.example.com
Authorization: Basic YWRtaW46czNjcmV0
```

Credentials are sent in the `Authorization` header, which is designed for this purpose and handled appropriately by intermediaries (not logged, stripped by proxies when needed).

## How Thymian Detects This

Thymian validates userinfo compliance using the following rules from the RFC 9110 rule set:

- **`sender-must-not-generate-userinfo-in-uri`** — Flags any HTTP request that includes a userinfo component in the URI. RFC 9110 is unambiguous: senders MUST NOT generate the userinfo subcomponent (and its `@` delimiter) in URI references.
- **`recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error`** — Warns when a recipient accepts a URI containing userinfo from an untrusted source. Before displaying the URI or using it to access the referenced resource, the recipient SHOULD reject it as an error.
- **`user-agent-must-not-include-fragment-or-userinfo-in-referer`** — Ensures that Referer headers do not leak userinfo. Even if a URI with userinfo was somehow used, the credentials must never propagate to other sites via the Referer header.

## Key Takeaways

- The `username:password@` syntax in HTTP URIs is deprecated — senders **must not** generate it
- URIs with userinfo are a phishing vector: `http://trusted.com@evil.com` goes to `evil.com`, not `trusted.com`
- Credentials in URIs leak into logs, Referer headers, browser history, and monitoring systems
- URL parsing inconsistencies around userinfo enable SSRF attacks where different components interpret the host differently
- Always use the `Authorization` header for credentials instead of embedding them in the URI

## Further Reading

- [RFC 9110, Section 4.2.1 — http URI Scheme](https://www.rfc-editor.org/rfc/rfc9110#section-4.2.1) — Deprecation of userinfo in HTTP URIs
- [RFC 3986, Section 3.2.1 — User Information](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1) — URI syntax definition of the userinfo component
- Orange Tsai, ["A New Era of SSRF — Exploiting URL Parsers"](https://www.blackhat.com/docs/us-17/thursday/us-17-Tsai-A-New-Era-Of-SSRF-Exploiting-URL-Parser-In-Trending-Programming-Languages.pdf) (Black Hat USA 2017) — Exploitation of URL parsing discrepancies including userinfo
- [CVE-2001-0328](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2001-0328) — Internet Explorer userinfo spoofing vulnerability
