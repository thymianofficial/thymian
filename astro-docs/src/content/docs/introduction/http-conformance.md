---
title: 'HTTP Conformance'
description: 'A comprehensive analysis of HTTP conformance, its architectural imperatives, and the out-of-the-box benefits of adhering to RFC 9110 semantics.'
tableOfContents:
  maxHeadingLevel: 4
---

## Introduction: The Essence of HTTP Conformance

The Hypertext Transfer Protocol (HTTP) is often mistakenly viewed in practice as a simple transport protocol for JSON
payloads. This misapprehension leads to architectures that ignore fundamental principles of the web, instead building
complex, proprietary business logic to solve problems that the standard has long since addressed. The core of the
protocol, defined in **RFC 9110 (HTTP Semantics)**, is not a transport mechanism but a semantic framework—a common
language and behavioral model for a globally distributed hypermedia system.[^1][^2] RFC 9110 establishes the "overall
architecture of HTTP" and defines the "common terminology".[^1][^2][^3]

Conformance in the context of RFC 9110 is therefore a profound contract. It demands adherence _both_ to the message
syntax (e.g., HTTP/1.1 or HTTP/2) and, crucially, to the _semantics_ of the protocol elements.[^1][^4] A client or
server that sends syntactically correct messages but violates the defined semantics (e.g., using a "safe" `GET` request
to delete data) will inevitably fail to interoperate with standard components.[^1]

The architectural costs of non-conformance are immense. Every semantic deviation from the standard—be it the incorrect
use of HTTP methods, the faulty interpretation of status codes, or the ignorance of Caching directives—must be
compensated for by proprietary "application logic." This logic must be individually implemented, maintained, and
versioned in _every_ client and _every_ server. This creates extremely tight coupling, destroys interoperability, and
leads to massive, long-term technical debt that undermines the entire system's longevity, security, and scalability.

Conversely, conformance is the decisive enabler. Strict adherence to the standards is the explicit "entry ticket" to
utilize a global ecosystem of highly optimized, generic intermediaries.[^2][^5] Proxies, Content Delivery Networks (
CDNs), Web Application Firewalls (WAFs), and browser caches are all designed to understand and act upon the semantics of
RFC 9110 "out-of-the-box." Tim Berners-Lee himself, during the standardization of HTTP/1.1, emphasized the significant
advantages in performance, security, and interoperability that result from conformance.[^6]

The Internet Engineering Task Force (IETF) deliberately formalized this separation in modern HTTP specifications. The
specifications were strategically split: RFC 9110 (Semantics) and RFC 9111 (Caching) are _separate_ from the transport
definitions in RFC 9112 (HTTP/1.1), RFC 9113 (HTTP/2), and RFC 9114 (HTTP/3).[^3][^7] The purpose of this separation is
to allow the transport "how" (the individual protocol versions) to evolve independently of the stable, underlying
semantic "what" (the interaction model).[^3] For architects, this means: Adherence to RFC 9110 is more fundamental and
more important to an application's longevity than the choice between HTTP/2 or HTTP/3. A semantic violation is an
architectural error that cannot be fixed by a transport upgrade.

The "out-of-the-box" benefits [^8] that are often taken for granted—such as global scalability [^9] or instant
caching [^10]—are no accident. They are the direct and measurable result of adhering to this semantic contract.
Non-conformance is therefore not just an implementation error [^11]; it is an active _exclusion_ from the ecosystem of
standardized web infrastructure.

## The HTTP Standard's Solution Framework: Categorized Mechanisms

The HTTP standard provides a comprehensive solution framework for the core problems of distributed systems. In practice,
these solutions are often replaced by proprietary "bad application logic," leading to the disadvantages previously
described. The following analysis catalogs the key standard solutions offered by RFC 9110 and related specifications.

### Solution Area 1: Unambiguous Semantics and State Transitions (Methods)

HTTP's primary mechanism for defining the _intent_ of a client request is its methods.[^12][^13] They are the contract
for what kind of action the server is expected to perform. RFC 9110 defines clear semantic properties for these methods.

**Safe Methods (Safe):**
Methods like `GET`, `HEAD`, and `OPTIONS` are defined as "safe."[^13][^14] This is a guarantee from the client to the
server that the request has _no intended side effects_ on the server's state. They are solely for retrieving
information. This guarantee is used by intermediaries like crawlers or prefetching mechanisms.
The anti-pattern of using `GET` for write actions (e.g., `GET /deleteUser?id=123`) [^15] breaks this fundamental
guarantee. A search engine crawler or an aggressive browser prefetcher, operating under the assumption that `GET`
requests are safe, could unintentionally delete data on the server simply by "visiting" this link. The conformant use of
`DELETE` or `POST` is thus a native, "out-of-the-box" defense against the normal behavior of web infrastructure.

**Idempotent Methods (Idempotent):**
Methods like `GET`, `HEAD`, `PUT`, and `DELETE` are defined as "idempotent."[^13][^14] Idempotency means that _multiple
identical requests have the same net effect on the server's state as a single request_.[^13][^14] The `POST` method is
explicitly defined as _not_ idempotent.[^13][^14]

This distinction is not an academic nicety but a standard solution that replaces complex, client-side "application
logic." A common problem in distributed systems is handling network errors (e.g., a timeout) where the client does not
know if its request reached the server.

:::caution
A client sends a request (e.g., `DELETE /resource/123`) and receives a network timeout. Unsure if the resource was
deleted, the client must implement complex, stateful recovery logic:

1. Send `GET /resource/123` to check the state.
2. _If_ the resource still exists (Status `200`), send the `DELETE` request _again_.
3. _If_ the resource does not exist (Status `404`), the first `DELETE` request was successful, and the client must do
   nothing.
   This is error-prone, proprietary logic.
   :::

:::tip
The client _knows_ that the `DELETE` method is idempotent.[^13][^14] In the event of a network timeout, the client _does
not need_ to check the state. It simply sends the `DELETE` request _safely again_ (a "safe retry"). If the first request
was successful, the second request will target the already-deleted resource (now `404`) or the same state (`204`), but
the server's _final state_ remains correct. The standard's semantics have eliminated the need for complex, stateful "
check-if-deleted" logic in the client.
:::

**Cacheable Methods (Cacheable):**
Methods like `GET` and `HEAD` are defined as primarily cacheable. `POST` can also be cacheable under
certain conditions, but it is not in the default configuration of most intermediaries.[^13][^16]

The following table summarizes the contractual obligations of HTTP method semantics according to RFC 9110.

**Table 1: Semantic Properties of HTTP Methods (RFC 9110)**

| Method        | Purpose (Simplified)                               | Is Safe | Is Idempotent | Primarily Cacheable |
| :------------ | :------------------------------------------------- | :------ | :------------ | :------------------ |
| **`GET`**     | Retrieve a representation                          | **Yes** | **Yes**       | **Yes**             |
| **`HEAD`**    | Retrieve only headers of a representation          | **Yes** | **Yes**       | **Yes**             |
| **`POST`**    | Process a resource / create a subordinate resource | No      | No            | (Conditional)       |
| **`PUT`**     | (Fully) replace or create a resource               | No      | **Yes**       | No                  |
| **`DELETE`**  | Delete a resource                                  | No      | **Yes**       | No                  |
| **`OPTIONS`** | Query communication options for a resource         | **Yes** | **Yes**       | No                  |
| **`TRACE`**   | Perform a "loop-back" test of the request          | **Yes** | **Yes**       | No                  |
| **`CONNECT`** | Establish a tunnel to the server [^17]             | No      | No            | No                  |

_Data sources for Table 1: [^13][^14][^17]_

### Solution Area 2: Reliable Communication and Error Handling (Status Codes)

HTTP status codes are the server's primary mechanism for communicating the _result_ of the requested semantic action in
a standardized way. They are divided into five classes that allow for immediate categorization of the
outcome.[^18][^19][^20]

The most fundamental distinction the standard makes is that of _responsibility_ for the error [^21]:

- **`2xx` (Successful):** The request was successful and understood.[^18][^19]
- **`4xx` (Client Error):** The request itself is faulty (e.g., invalid syntax, resource not found, lacking
  permissions). The server _could not or would not_ process the request. The client _must not repeat the request without
  modification_.[^18][^21][^22][^23]
- **`5xx` (Server Error):** The request was syntactically and semantically valid, but the server encountered an
  _internal problem_ that prevented it from fulfilling the request.[^18][^21][^22]

This 4xx/5xx separation is not merely informative; it is a critical mechanism for _automating the assignment of
responsibility_ in distributed systems. Every "out-of-the-box" monitoring tool, API gateway, or observability stack
relies on this semantic.

:::caution
A server returns `500 Internal Server Error` because the client sent invalid data (e.g., a badly formatted date).[^22]
:::

:::note[Consequence]
The monitoring system (e.g., an API gateway) detects a `5xx` spike and alerts the _server operations team_ (SREs). This
team begins a costly investigation on the server, only to find it is functioning perfectly and the problem lies with the
client. This leads to "alert fatigue" and wastes valuable operational resources.
:::

:::tip
The server recognizes the invalid data and correctly responds with `400 Bad Request`.[^23] The monitoring system
registers this as a client error. It can now automatically alert the _client's development team_ or even temporarily
rate-limit the client. The correct use of status codes automatically routes the error to its source. This is what is
meant by "Troubleshooting made easy" and "Uniform error handling."[^24]
:::

Furthermore, specific status codes define the _next permissible steps_ in a protocol, acting as a machine-readable state
machine:

- **`201 Created`:** Signals that a resource was successfully created. The response _should_ include a `Location` header
  specifying the URI of the _new_ resource.[^15][^19]
- **`204 No Content`:** Signals success but informs the client that no response body will be sent, intentionally (e.g.,
  after a `DELETE` request).[^22] The client does not need to wait for a body.
- **`401 Unauthorized`:** Signals that authentication is required. This response _must_ include a `WWW-Authenticate`
  header that provides the "challenge" (i.e., the required authentication methods) to the client.[^1][^25]
- **`403 Forbidden`:** Signals that authentication was successful (or is not required), but the client _lacks
  permission_ for the requested action.[^24] This is semantically and fundamentally different from `401`.
- **`409 Conflict`:** Signals that the request could not be processed because it conflicts with the _current state_ of
  the target resource (e.g., a versioning conflict).[^22]

### Solution Area 3: Performance and Scalability (Caching, RFC 9111)

HTTP caching, defined in **RFC 9111**, is the standard solution for drastically reducing latency and network
overhead.[^5][^26] It is a local store for response messages.[^10] The standard defines a sophisticated, two-stage
system that goes far beyond what most proprietary "in-app" caches provide.

**Mechanism 1: Expiration**
This is the first stage of optimization. The server tells the cache (browser or intermediary) via the `Cache-Control`
response header how long a representation is considered "fresh," typically via `max-age` (e.g.,
`Cache-Control: max-age=3600` for one hour).[^27][^28] As long as the response is fresh, it is served _without any
network request_ to the origin server.[^29] This completely eliminates both server load and network latency.[^30]

**Mechanism 2: Validation**
This is the second stage of optimization, which applies when the response is "stale" (expired). Instead of blindly
re-requesting the _entire_ resource, the cache _must_ check with the server ("revalidate").[^29][^30] To make this
process efficient, the server provides "validators":

- **`ETag` (Entity Tag):** An opaque token that represents a specific version of the resource (e.g., a hash of the
  content).[^30][^31]
- **`Last-Modified`:** A timestamp of the last modification.[^31]

The cache sends these validators in a _conditional request_ (e.g., `If-None-Match: "etag-value"`). The server now
performs a quick check:

- _If_ the resource has _not_ changed, the server responds with **`304 Not Modified`**. This response has an _empty
  body_.[^29][^30][^31] The cache now knows its "stale" copy is "fresh" again and serves it.
- _If_ the resource has changed, the server responds with `200 OK` and the _new, complete_ resource.

This two-stage system is architecturally superior to implementing a proprietary "in-app" cache (e.g., in Redis). A
typical in-app cache often only implements Stage 1 (Expiration). When the Redis entry expires, the server _must_
regenerate the data (e.g., a 10 MB JSON document) and send the _full response_ to the client. The HTTP model is more
efficient: even if `max-age` (Stage 1) has expired, Stage 2 (Validation) can still save 10 MB of bandwidth by sending a
`304` if the data has not _factually_ changed.

**The `Cache-Control` "API"**
The `Cache-Control` header is an "API" that allows the origin server to programmatically control the behavior of a
complex, global ecosystem of intermediaries (CDNs, proxies).[^32][^33]

- **`private` vs. `public`:** The standard distinguishes between `private` caches (for a single user, e.g., a browser
  cache) and `shared` caches (for many users, e.g., a CDN, proxy).[^5][^26] With `Cache-Control: private`, the server
  forbids a CDN from storing the response. With `Cache-Control: public`, it explicitly permits it.[^28]
- **Security through Semantics (Authentication):** The standard (RFC 9111) is "secure-by-default." It mandates that a
  `shared` cache (CDN) _must never_ store a response to a request containing an `Authorization` header, as it is by
  definition user-specific.[^5][^26] This response may only be stored in a `private` cache (the user's browser). A
  server can _only_ override this behavior with explicit directives like `public` or `s-maxage`.[^5]

### Solution Area 4: Flexibility and Representation (Content Negotiation)

Content Negotiation is the HTTP-conformant mechanism for serving different representations of the same resource under _a
single, stable URI_.[^34] This solves the problem of different clients needing different formats (e.g., JSON vs. XML),
languages (e.g., German vs. English), or encodings (e.g., Gzip vs. Brotli).

**Server-driven Negotiation (Proactive Negotiation):**
This is the standard mechanism.[^34]

1. The client sends _Accept headers_ in its request, listing its preferences and capabilities.

- **`Accept`:** Defines the preferred media types (MIME types). Example:
  `Accept: application/json, application/xml;q=0.8` (meaning: "I prefer JSON, but XML is acceptable with a priority of
  0.8").[^35][^36][^37]
- **`Accept-Language`:** Defines the preferred languages. Example: `Accept-Language: de-DE, en-US;q=0.7`.[^38]
- **`Accept-Encoding`:** Defines the supported compression algorithms. Example: `Accept-Encoding: gzip, br`.[^34][^38]

2. The server analyzes these headers, compares them with its available representations, and selects the _best_ matching
   variant.
3. The server sends the selected representation back, informing the client of its choice with response headers like
   `Content-Type`, `Content-Language`, and `Content-Encoding`.[^35][^38]

**Reactive Negotiation:**
If the server cannot find a suitable representation, it can respond conformantly with `406 Not Acceptable` or offer a
list of available options with `300 Multiple Choices`.[^34]

This standard mechanism is superior to "bad application logic," which typically solves the same problem using
proprietary URL parameters (e.g., `?format=json`) or URI structure (e.g., `/resource.json` vs. `/resource.xml`).

The question of why negotiation is superior to a URL parameter is answered clearly in the technical community: "
Standardization."[^39] A generic client _understands_ `Accept` headers "out-of-the-box." It _does not understand_ a
proprietary `?format=` parameter. By adhering to the standard, the resource remains accessible at a stable URI for _any_
conformant client (including future, unknown clients) without them needing to know the API's proprietary
conventions.[^39]

Furthermore, using `Accept` decouples the server's evolution from the client base. A server (V1) might, for example,
only serve XML. A client (V1) sends `Accept: application/xml`. Later, the server (V2) is updated to _also_ serve JSON.
The old client (V1) continues to work _unchanged_, as its request is still served correctly. A new client (V2) can now
send `Accept: application/json` and receive the more modern format. The URI `/resource/123` remains stable for both
clients.[^34] This prevents the need for hard API versioning (e.g., `/v2/...`).

### Solution Area 5: Security and State (Authentication and State Management)

**Part A: HTTP Authentication (RFC 9110)**
Contrary to the assumption that HTTP is designed only for cookie-based authentication, the standard (historically RFC
7235, now integrated into RFC 9110) defines a powerful, schema-agnostic _framework_ for
authentication.[^1][^4][^40][^41][^42][^43] It is a stateless challenge-response mechanism.[^40][^41][^44]

The standard flow is as follows [^25][^41][^44]:

1. **Anonymous Request:** The client requests a protected resource (e.g., `GET /admin`).
2. **Server Challenge:** The server rejects the request with **`401 Unauthorized`**. It _must_ include a \* \*`WWW-Authenticate`\*\* header in this response.[^45] This header defines the "challenge"—the methods the server
   accepts (e.g., `WWW-Authenticate: Basic realm="Admin Area"` or `WWW-Authenticate: Bearer` for tokens).
3. **Client Response:** The client (e.g., a browser) can now prompt the user for credentials. It repeats the request,
   adding the **`Authorization`** header with the credentials in the format requested by the server (e.g.,
   `Authorization: Basic YWxhZGRpbjp...`).[^1][^46]

The advantage of this framework is its flexibility. The server can offer multiple schemes to the client (e.g.,
`WWW-Authenticate: Digest...`, `WWW-Authenticate: Bearer...`).[^45][^47] The client _chooses_ the most secure scheme it
understands.[^45][^46]

"Bad application logic" reinvents this framework, typically through a proprietary header (e.g., `X-Api-Key`). This
breaks interoperability with standard tools. A browser or a tool like `curl` _understands_ the `401`/`WWW-Authenticate`
flow "out-of-the-box" and can react accordingly (e.g., with a password prompt).[^41] These tools have no knowledge of a
proprietary `X-Api-Key` scheme.

**Part B: HTTP State Management (RFC 6265 - Cookies)**
Since HTTP itself is a stateless protocol [^1], **RFC 6265 (HTTP State Management Mechanism)** is the standard that
allows a server to store _state_ in the user agent (browser) to manage a "stateful session."[^48][^49][^50][^51]

The standard defines not only the `Set-Cookie` and `Cookie` headers [^49][^52] but also—crucially—the _security
attributes_ that serve as standard solutions for well-known attack vectors:

- **`Secure` attribute:** Ensures the cookie is only sent over "secure" channels (i.e., HTTPS).[^53][^54] This is the
  standard solution against sniffing session cookies in insecure networks.
- **`HttpOnly` attribute:** Prevents the cookie from being accessed via client-side scripts (i.e.,
  `document.cookie`).[^54][^55] This is the primary, "out-of-the-box" line of defense against session cookie theft via
  Cross-Site Scripting (XSS) attacks.[^55]
- **`SameSite` attribute (Lax, Strict, None):** Controls whether a cookie is sent with cross-site requests (i.e.,
  requests from a different domain).[^54][^56][^57] This is the primary, "out-of-the-box" line of defense against
  Cross-Site Request Forgery (CSRF) attacks.[^58]

Non-conformant implementations (e.g., setting a session cookie without `HttpOnly` and `SameSite=Strict`) actively
_create_ the attack vectors for XSS and CSRF.[^59][^60] The "application logic" must then arduously mitigate these
threats _again_, typically by implementing Content Security Policies (CSP) and anti-CSRF tokens. Conformance with RFC
6265 is the first, cheapest, and strongest line of defense that the standard provides natively.

## Analysis: HTTP Anti-Patterns and "Bad Application Logic"

The refusal to use standard solutions leads to a series of well-known anti-patterns.[^15][^61] These anti-patterns are
often a direct symptom of "business logic" or "bad application logic" having taken control of the protocol's behavior.

### Anti-Pattern 1: The "200 OK" Lie (Ignoring Status Codes)

This is one of the most harmful anti-patterns.[^15] Instead of using the semantically correct status code, the API
_always_ returns `HTTP 200 OK`. The "actual" status is wrapped in a proprietary JSON envelope in the
body.[^22][^62][^63]

:::danger

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ERROR",
  "success": false,
  "data": null,
  "error": {
    "code": "E404",
    "message": "User not found"
  }
}
```

:::

:::tip

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "User not found"
}
```

_or simply an empty `404` body._
:::

**Drawbacks (Technical Debt):**

- **Breaks the Ecosystem:** This anti-pattern blinds _every_ standard tool (monitoring, caching, proxies,
  gateways).[^24]
- **Faulty Monitoring:** Monitoring systems see 100% `200 OK` responses and incorrectly report a 100% success rate. The
  system is down, but the dashboard is "green."
- **Faulty Caching:** A CDN or proxy configured to cache `200` responses might incorrectly cache this _error message_
  and serve it to other users.[^64][^65]
- **Complex Clients:** The client _must_ parse the body of _every_ `200` response to find out if the request was
  _actually_ successful.[^22] This doubles the error-handling logic (once for network/HTTP errors, once for the
  proprietary body error).

### Anti-Pattern 2: Method Tunneling (Ignoring Semantics)

This anti-pattern treats HTTP as a "dumb" transport protocol in an RPC (Remote Procedure Call) style.[^61] Every action,
regardless of its semantics (read, write, delete), is tunneled over a single method (usually `POST`) to a single
endpoint (e.g., `/api`).[^15]

:::danger

```http
POST /api HTTP/1.1
Content-Type: application/json

{
  "action": "getUser",
  "id": 123
}
```

_instead of `GET /users/123`_

```http
POST /api HTTP/1.1
Content-Type: application/json

{
  "action": "deleteUser",
  "id": 123
}
```

_instead of `DELETE /users/123`_
:::

:::tip
Use the correct method for the specific resource (e.g., `GET /users/123`).[^66]
:::

**Drawbacks (Technical Debt):**

- **Total Loss of Caching:** Since _every_ action is a `POST`, _nothing_ can be cached by standard caches (browser, CDN,
  proxy), as `POST` requests are generally not considered cacheable.[^67][^68] Every single read request hits the origin
  server.
- **Loss of Idempotency:** The client loses the "safe retry" guarantee for idempotent actions (like `DELETE`), as `POST`
  is not idempotent.[^13]
- **Loss of "Safe" Guarantees:** If `GET` is misused for write operations, there is a risk of unintentional data
  modification by crawlers.[^15]
- **Workarounds:** This anti-pattern is so common that workarounds like the `X-HTTP-Method-Override` header [^69][^70]
  were invented to bypass firewalls that only allow `POST`—a "workaround for a workaround" that completely breaks
  semantics.

### Anti-Pattern 3: "In-App" Caching (Ignoring RFC 9111)

Out of ignorance or distrust of HTTP caching, developers implement their own proprietary caching layers within the
application (e.g., with Redis or in-memory maps) [^71], while completely ignoring HTTP caching headers.[^15][^61]

:::tip
Use the `Cache-Control` (for expiration) and `ETag` / `Last-Modified` (for validation) headers.[^26][^30]
:::

**Drawbacks (Technical Debt):**

- **Reinventing the Wheel:** Implementing a correct, thread-safe cache invalidation strategy is one of the hardest
  problems in computer science and is being needlessly reimplemented here.
- **Inefficient:** As explained in II.3, this approach almost always lacks the superior two-stage (Expiration +
  Validation) system of the HTTP standard.[^30]
- **Invisible to Intermediaries:** The most severe drawback. The in-app cache is _invisible_ to the entire ecosystem. A
  user's request from Asia _must_ cross the globe, pass through the CDN and proxy (which cannot cache), and hit the
  origin server in Europe, _just_ for the in-app cache to serve the response. A conformant `Cache-Control` header would
  have allowed the CDN in Asia to serve the response in milliseconds.[^10]

### Anti-Pattern 4: Insecure State Management (Ignoring RFC 6265)

This anti-pattern consists of setting authentication or session cookies without using the security attributes provided
by the standard.[^54][^55]

:::danger
`Set-Cookie: session=abc123xyz...`
:::

:::tip
`Set-Cookie: session=abc123xyz...; Secure; HttpOnly; SameSite=Strict`
:::

**Drawbacks (Technical Debt):**

- **Direct Attack Vectors:** This non-conformance is _not_ a theoretical weakness; it _is_ the vulnerability.
- **XSS Vulnerability:** The absence of `HttpOnly` allows an attacker who finds an XSS flaw to steal the cookie via
  JavaScript (`document.cookie`) and take over the user's session.[^55][^59]
- **CSRF Vulnerability:** The absence of `SameSite` allows an authenticated user's browser to send the cookie with a
  request from a malicious site (e.g., in an `<img>` tag or form), leading to a Cross-Site Request Forgery.[^58][^60]
- **Increased Complexity:** The "application logic" must now _re-implement_ this standard defense, for example, by
  implementing anti-CSRF tokens—a solution that the `SameSite` attribute would have solved "out-of-the-box" and more
  robustly.

### Table 2: Comparison: "Application Logic" vs. "HTTP Standard Solution"

This table summarizes the direct confrontation between common proprietary workarounds and the superior standard
solutions.

| Problem                      | Anti-Pattern / "Bad Application Logic"                                          | Conformant HTTP Solution (RFC 9110/9111/6265)                               | "Out-of-the-Box" Benefit of Conformance                                                            |
| :--------------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Error Message**            | `HTTP 200 OK` + `{ "success": false }` [^22]                                    | `HTTP 4xx` (e.g., `400`, `404`) or `5xx` [^22]                              | Automatic monitoring, alerting, client handling, no Caching of errors [^24][^65]                   |
| **State-changing Action**    | `POST /api {"action": "deleteUser"}` [^15]                                      | `DELETE /users/{id}`                                                        | Idempotency ("safe retry") [^13], CDN/proxy invalidation [^68], semantic clarity                   |
| **Data Creation**            | `POST /api {"action": "createUser"}`                                            | `POST /users` (leading to `201 Created` + `Location` header) [^19]          | Discovery of the new resource, semantic clarity [^15]                                              |
| **Data Retrieval (Caching)** | `POST /api {"action": "getUser"}` OR `GET /users/{id}` (no cache headers) [^15] | `GET /users/{id}` + `Cache-Control: max-age=...` + `ETag: "..."` [^26][^30] | CDN, proxy & browser caching (Expiration) [^28] AND bandwidth saving (Validation with `304`) [^30] |
| **Format Selection**         | Proprietary parameter (e.g., `?format=json`) or URI (`.json`)                   | `Accept: application/json` header [^34][^35]                                | Stable URIs, decoupling of clients, interoperability with generic tools [^34][^39]                 |
| **Session Security (CSRF)**  | `Set-Cookie: session=...` (no `SameSite`) + Anti-CSRF token in app logic        | `Set-Cookie:...; SameSite=Strict` [^56]                                     | Native, robust CSRF protection directly in the browser, no complex token logic needed [^54]        |
| **Session Security (XSS)**   | `Set-Cookie: session=...` (no `HttpOnly`) + Content Security Policy (CSP)       | `Set-Cookie:...; HttpOnly` [^54]                                            | Native protection against cookie theft via JavaScript, first line of defense [^55]                 |

## The Multiplier Effect: "Out-of-the-Box" Benefits of Conformance

Adherence to HTTP semantics is not an academic exercise [^11] but a fundamental architectural investment. The "cost" of
adherence (i.e., correctly setting headers and using methods/status codes) _unlocks_ an ecosystem of generic, highly
optimized intermediaries.[^2][^32] The performance of these standard components (CDNs, proxies, browsers) surpasses that
of _any_ proprietary "in-app" solution by orders of magnitude.

The "out-of-the-box" benefits [^8] are the direct result of this leverage. Intermediaries, from an IBM Proxy
Server [^32] to a global CDN like Cloudflare [^65], are programmed to strictly interpret the semantics of RFC 9110 and
RFC 9111.

Consider two scenarios:

- **Scenario A (Non-conformant):** An API uses Anti-Patterns 1 (errors as `200`) and 2 (everything over `POST`). An
  expensive, global CDN is placed in front of this API. The result: The CDN is _useless_. Every single request is a
  `POST`, is classified as "not cacheable" (Cache-Miss), and must be forwarded to the origin server.[^67][^68] The CDN
  cannot distinguish between success and failure (everything is `200`).[^65] The developer has _disabled_ a global
  infrastructure worth millions.
- **Scenario B (Conformant):** An API uses `GET /resource` with `Cache-Control: public, max-age=60` [^28] and an
  `ETag`.[^30] The CDN serves 99.9% of requests globally from its edge locations without contacting the origin
  server.[^10] After 60 seconds, it validates efficiently with `If-None-Match` and a `304`.[^30] The server load
  collapses.

The _only_ difference between global failure and global scalability in this case was HTTP conformance.

### Benefit 1: Transparent Scalability (CDNs & Proxies)

Intermediaries use HTTP semantics for far more than just caching `200 OK` responses:

- **Method Caching:** They aggressively cache `GET` and `HEAD`.[^16][^68] They know that `PUT` and `DELETE` change state
  and, upon arrival, _automatically invalidate_ the cached `GET` responses for that resource.[^29][^68] An API that only
  uses `POST` robs the CDN of this cache invalidation capability.
- **Status Code Caching (Negative Caching):** CDNs [^65] and proxies [^32] don't just cache success. They _conformantly_
  cache `301 Moved Permanently` (often for a long time) and `404 Not Found` (typically for a short time, e.g., 3
  minutes).[^65][^72] This is a critical "out-of-the-box" protection mechanism that shields the origin server from
  repeated, pointless requests for non-existent resources (e.g., during a denial-of-service attack or from a faulty
  client). An API that masks errors as `200 OK` loses this protection.
- **Authentication Caching (Security Function):** As detailed in II.3, the default behavior of a `shared` cache (CDN) is
  _security-critical_: It _must not_ store a response to a request with an `Authorization` header, as it could contain
  private data.[^5][^26] "Bad application logic" (e.g., passing an API key or session token as a _URL parameter_)
  bypasses this built-in protection. The CDN does not see the `Authorization` header, incorrectly treats the request as
  anonymous and public, and caches the private response. The next user to request the same URL receives the previous
  user's private data (Cache Poisoning). Conformance (using the `Authorization` header) prevents this massive data
  leak "out-of-the-box."

### Benefit 2: Increased Security and Resilience (WAFs & Studies)

Adherence to HTTP specifications is not just a formality; it is a fundamental security practice. Web Application
Firewalls (WAFs) and API gateways use HTTP semantics as a first line of defense to detect anomalies (e.g., a `GET`
request with a body, which could indicate a smuggling attack). A non-conformant application is far more difficult for a
WAF to protect, as it cannot distinguish "normal" traffic from "abnormal" traffic.

The need for conformance is not just theoretical. Empirical studies "harden" this argument by demonstrating the
widespread prevalence of non-conformance and its direct security implications.

**Evidence 1: CISPA-Studie (2024) - HTTP Conformance**
A systematic analysis of HTTP conformance and its security impacts [^7] extracted 106 testable rules from the core
RFCs (9110-9113, 6265 etc.) and tested them against real servers.

- **Result:** Conformance is extremely low. "Most HTTP systems break at least one rule," and "more than half of all
  rules were broken at least once."[^7]
- **Consequences:** These violations are not harmless; they lead directly to known security vulnerabilities [^7]:
  - **HTTP Request Smuggling (HRS):** Caused by semantic violations such as sending a _body in a `304 Not Modified`
    response_, "incorrect whitespace" in headers, or "forbidden headers" (e.g., `Content-Length` in a `204` response).
    These violations lead to parser desynchronization between a proxy and the backend server.[^7]
  - **Cross-Site Scripting (XSS):** Caused by a "missing `Content-Type` header." When this header is missing, browsers
    are forced to perform "MIME-sniffing," which can lead to an uploaded file (e.g., an image) being misinterpreted as
    HTML or script and executed.[^7]
  - **Security Policy Bypass:** Caused by "duplicate headers" (e.g., two `Strict-Transport-Security` headers). Different
    intermediaries (browser, proxy) may pick the first or the last header, leading to inconsistent and potentially
    insecure processing.[^7]
  - **Illegal Characters:** Many servers (7 of 9 tested) failed to correctly reject requests with illegal characters
    (like
    `CR`, `LF`, `NUL`) in headers with `400 Bad Request`, which can also lead to smuggling attacks.[^7]

**Evidence 2: Studie "Non-compliant and Proud" (2008)**
This earlier study also confirmed the widespread nature of non-conformance, particularly in the implementation of HTTP
methods. It concluded that many websites are "non-compliant out of choice, not necessity"—the servers _could_ be
conformant but are not, due to misconfigurations.[^73]

Taken together, these studies prove that adherence to the specifications is a native, "out-of-the-box" defense against
entire classes of complex protocol attacks (like HRS). Non-conformance is an invitation for these attacks.

### Table 3: Evidence-Based Risks of Non-Conformance (based on studies)

This table links the rule violations observed in research [^7] directly to the resulting security vulnerabilities and
the standard semantics that were violated.

| Observed Non-Conformance [^7]                                      | Violated Semantics (RFC)                         | Potential Security Impact (Out-of-the-Box Loss)                        |
| :----------------------------------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------- |
| **Body in `304 Not Modified` response**                            | RFC 9110 (Semantics: `304` must not have a body) | **HTTP Request Smuggling (HRS)** via parser desynchronization [^7]     |
| **Incorrect Whitespace** (e.g., in header names)                   | RFC 9110 / 9112 (ABNF syntax)                    | **HTTP Request Smuggling (HRS)**, parser confusion, filter bypass [^7] |
| **Missing `Content-Type` header**                                  | RFC 9110 (Semantics: Define content semantics)   | **Cross-Site Scripting (XSS)** via browser MIME-sniffing [^7]          |
| **Duplicate Security Headers** (e.g., `Strict-Transport-Security`) | RFC 9110 (Header field definitions)              | Inconsistent security policy, bypass of protections [^7]               |
| **Illegal Characters** (`CR`, `LF`, `NUL`) in header values        | RFC 9110 (Semantics: Must be rejected as `400`)  | **HTTP Request Smuggling (HRS)**, injection attacks [^7]               |

## Summary Analysis and Architectural Recommendations

The analysis presented shows that HTTP conformance, particularly adherence to the semantics of RFC 9110, is not an "
academic exercise" [^11] or technical dogma. It is a deliberate and fundamental _architectural decision_ in favor of
robustness, longevity [^3], security, and scalability.[^9]

The "business logic" or "bad application logic" observed by the querent, which leads to the bypassing of HTTP standards,
is almost invariably a more expensive, proprietary, error-prone, and lower-performance reinvention of an already
existing, highly optimized, and globally understood standard function.

1. **Conformance Resolves Complexity:** The standard semantics for idempotency (RFC 9110) [^13], caching (RFC

9111) [^26][^30], and state management security (RFC 6265) [^54] eliminate the need for complex, proprietary client
      logic (e.g., "safe-retry" checks, anti-CSRF tokens, in-app caches).

2. **Conformance is the Key to Scalability:** The "out-of-the-box" benefits of a global ecosystem of intermediaries (
   CDNs, proxies, browsers) [^8][^32] are _directly_ tied to semantic adherence. Non-conformant APIs (e.g., through
   method tunneling or `200 OK` error messages) _disable_ this infrastructure.[^22][^65][^67]
3. **Conformance is an "Out-of-the-Box" Security Feature:** As empirical studies demonstrate [^7], strict adherence to
   protocol semantics (e.g., correct length specifications, no bodies in `304` responses, correct cookie attributes) is
   a native line of defense against entire classes of attacks like HTTP Request Smuggling and Cross-Site Scripting.

The refusal to be HTTP-conformant is, ultimately, a refusal to leverage the benefits of a globally scaled, highly secure
distributed system optimized for over 30 years.[^6] It is the equivalent of provisioning a high-performance CDN [^74]
and then, through `POST` method tunneling [^15], effectively degrading it into a simple, expensive load balancer.

Adherence to HTTP semantics, as laid out in RFC 9110, is not an obstacle to implementing business logic; it is the
indispensable foundation upon which professional, future-proof, and scalable web architectures are built.

---

[^1]: [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)

[^2]: [Information on RFC 9110 » RFC Editor](https://www.rfc-editor.org/info/rfc9110)

[^3]: [RFC 9110 - HTTP Semantics - IETF Datatracker](https://datatracker.ietf.org/doc/rfc9110/)

[^4]: [RFC 9110 - HTTP Semantics - IETF Datatracker](https://datatracker.ietf.org/doc/html/rfc9110)

[^5]: [RFC 9111 - HTTP Caching - IETF Datatracker](https://datatracker.ietf.org/doc/html/rfc9111)

[^6]: [World Wide Web Consortium Supports HTTP/1.1 Reaching IETF Draft Standard - W3C](https://www.w3.org/press-releases/1999/http11/)

[^7]: [Who's Breaking the Rules? Studying Conformance to the HTTP ...](https://swag.cispa.saarland/papers/rautenstrauch2024conformance.pdf)

[^8]: [What is OOTB (Out of the Box) Solutions?](https://artoonsolutions.com/glossary/ootb/)

[^9]: [Was ist Skalierbarkeit in der IT? Kurz und einfach erklärt - RNT | Rausch](https://rnt.de/glossar/skalierbarkeit/)

[^10]: [Was ist Web-Caching und wie funktioniert es? - Bluehost](https://www.bluehost.com/de-de/blog/was-ist-web-caching-und-wie-funktioniert-es/)

[^11]: [HTTP Compliance and W3C QA](https://www.w3.org/2001/01/qa-ws/pp/alex-rousskov-measfact.html)

[^12]: [What are HTTP Methods (GET, POST, PUT, DELETE) - Apidog](https://apidog.com/blog/http-methods/)

[^13]: [HTTP request methods - HTTP | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods)

[^14]: [Idempotent Requests in HTTP - Fullstack.wiki](https://fullstack.wiki/http/idempotent.html)

[^15]: [REST Anti-Patterns - InfoQ](https://www.infoq.com/articles/rest-anti-patterns/)

[^16]: [HTTP Caching and Proxy Behavior - OpenStack Specifications](https://specs.openstack.org/openstack/api-wg/guidelines/http/caching.html)

[^17]: [CONNECT request method - HTTP - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/CONNECT)

[^18]: [HTTP Status Codes: All 63 explained - including FAQ & Video - Umbraco](https://umbraco.com/knowledge-base/http-status-codes/)

[^19]: [HTTP response status codes - MDN Web Docs - Mozilla](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)

[^20]: [List of HTTP status codes - Wikipedia](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes)

[^21]: [Status codes in HTTP - W3C](https://www.w3.org/Protocols/HTTP/HTRESP.html)

[^22]: [What Are HTTP Status Codes? Complete Guide - Postman Blog](https://blog.postman.com/what-are-http-status-codes/)

[^23]: [HTTP Status Codes - REST API Tutorial](https://restfulapi.net/http-status-codes/)

[^24]: [The importance of HTTP status codes to REST-based APIs - Treblle](https://treblle.com/blog/the-importance-of-http-status-codes-in-rest-apis)

[^25]: [401 Unauthorized - HTTP - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401)

[^26]: [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)

[^27]: [Cache-Control header - HTTP - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)

[^28]: [What is cache-control? | Cache explained - Cloudflare](https://www.cloudflare.com/learning/cdn/glossary/what-is-cache-control/)

[^29]: [ETag update after resource modification - Stack Overflow](https://stackoverflow.com/questions/79207937/etag-update-after-resource-modification)

[^30]: [ETags: What they are, and how to use them | Fastly](https://www.fastly.com/blog/etags-what-they-are-and-how-to-use-them)

[^31]: [HTTP caching - MDN Web Docs - Mozilla](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)

[^32]: [Overview of proxy server caching - IBM](https://www.ibm.com/docs/en/was-nd/8.5.5?topic=caching-overview-proxy-server)

[^33]: [HTTP Proxy Caching — Apache Traffic Server documentation](https://docs.trafficserver.apache.org/admin-guide/configuration/cache-basics.en.html)

[^34]: [Content negotiation - HTTP | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation)

[^35]: [Accept header - HTTP - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept)

[^36]: [Content Negotiation - Apache HTTP Server Version 2.4](https://httpd.apache.org/docs/current/content-negotiation.html)

[^37]: [Content Negotiation in a REST API](https://restfulapi.net/content-negotiation/)

[^38]: [Content Negotiation in ASP.NET Web API - Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/web-api/overview/formats-and-model-binding/content-negotiation)

[^39]: [Why would HTTP content negotiation be preferred to explicit parameters in an API scenario?](https://stackoverflow.com/questions/44735653/why-would-http-content-negotiation-be-preferred-to-explicit-parameters-in-an-api)

[^40]: [RFC 7235 - Hypertext Transfer Protocol (HTTP/1.1): Authentication - IETF Datatracker](https://datatracker.ietf.org/doc/html/rfc7235)

[^41]: [HTTP authentication - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication)

[^42]: [HTTP Authentication : Methods and Strategies to Protect your Application - Medium](https://medium.com/@diego.coder/http-authentication-methods-and-strategies-to-protect-your-application-cda2ce9147a7)

[^43]: [Information on RFC 7235 - » RFC Editor](https://www.rfc-editor.org/info/rfc7235)

[^44]: [WWW-Authenticate header - HTTP | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/WWW-Authenticate)

[^45]: [WWW-Authenticate header - HTTP - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/WWW-Authenticate)

[^46]: [Authorization header - HTTP - MDN Web Docs - Mozilla](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Authorization)

[^47]: [Understanding HTTP Authentication - WCF - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/framework/wcf/feature-details/understanding-http-authentication)

[^48]: [HTTP cookie - Wikipedia](https://en.wikipedia.org/wiki/HTTP_cookie)

[^49]: [Information on RFC 6265 - » RFC Editor](https://www.rfc-editor.org/info/rfc6265)

[^50]: [Cookies: HTTP State Management Mechanism](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html)

[^51]: [Using HTTP cookies - MDN Web Docs - Mozilla](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)

[^52]: [RFC 6265: HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265.html)

[^53]: [RFC 6265 - HTTP State Management Mechanism - IETF Datatracker](https://datatracker.ietf.org/doc/html/rfc6265)

[^54]: [Understanding Secure Cookies | BrowserStack](https://www.browserstack.com/guide/cookie-secure)

[^55]: [Securing Cookies Using HTTP Headers - Infosec Institute](https://www.infosecinstitute.com/resources/general-security/defending-against-web-attacks-using-http-headers-part-3/)

[^56]: [SameSite Cookie Attribute explained](https://cookie-script.com/documentation/samesite-cookie-attribute-explained)

[^57]: [SameSite-Cookies | Articles - web.dev](https://web.dev/articles/samesite-cookies-explained?hl=de)

[^58]: [XSS vs CSRF | Web Security Academy - PortSwigger](https://portswigger.net/web-security/csrf/xss-vs-csrf)

[^59]: [CSRF vs. XSS - open-appsec](https://www.openappsec.io/post/csrf-vs-xss)

[^60]: [XSS vs CSRF: Key Differences & How They Work - Invicti](https://www.invicti.com/blog/web-security/xss-vs-csrf-differences)

[^61]: [REST anti-patterns - Marcelo Cure - Medium](https://marcelocure.medium.com/rest-anti-patterns-b128597f5430)

[^62]: [When 200 OK Is Not OK - Unveiling the Risks of Web Responses In API Calls - Graylog](https://graylog.org/post/when-200-ok-is-not/)

[^63]: [Returning http 200 OK with error within response body - Stack Overflow](https://stackoverflow.com/questions/27921537/returning-http-200-ok-with-error-within-response-body)

[^64]: [Caching overview | Cloud CDN - Google Cloud Documentation](https://docs.cloud.google.com/cdn/docs/caching)

[^65]: [Cache by status code - Cloudflare Docs](https://developers.cloudflare.com/cache/how-to/configure-cache-status-code/)

[^66]: [Understanding and Using HTTP Methods: GET, POST, PUT, DELETE | by August - Medium](https://medium.com/@2957607810/understanding-and-using-http-methods-get-post-put-delete-794cda75470e)

[^67]: [what does cache means in POST and GET - Stack Overflow](https://stackoverflow.com/questions/27020783/what-does-cache-means-in-post-and-get)

[^68]: [What data is cached by web proxy server(or other http caches)? - Stack Overflow](https://stackoverflow.com/questions/39751143/what-data-is-cached-by-web-proxy-serveror-other-http-caches)

[^69]: [Tunneling HTTP verbs - OneDrive API - Microsoft Learn](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/http-verb-tunneling?view=odsp-graph-online)

[^70]: [HTTP Verb Tunnelling - Fano Framework](https://fanoframework.github.io/security/http-verb-tunnelling/)

[^71]: [Introduction to antipatterns | Apigee - Google Cloud Documentation](https://docs.cloud.google.com/apigee/docs/api-platform/antipatterns/intro)

[^72]: [CDN:Configure TTL for HTTP status code - Alibaba Cloud](https://www.alibabacloud.com/help/en/cdn/user-guide/create-a-cache-rule-for-http-status-codes)

[^73]: [Non-compliant and Proud: A Case Study of HTTP Compliance - ResearchGate](https://www.researchgate.net/profile/Ralph-Johnson-3/publication/32964874_Non-compliant_and_Proud_A_Case_Study_of_HTTP_Compliance/links/555f593e08ae86c06b636c08/Non-compliant-and-Proud-A-Case-Study-of-HTTP-Compliance.pdf?origin=scientificContributions)

[^74]: [Common CDN issues and how to fix them - Cloudflare](https://www.cloudflare.com/learning/cdn/common-cdn-issues/)
