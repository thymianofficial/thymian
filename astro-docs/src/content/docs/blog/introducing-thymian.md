---
title: 'Introducing Thymian: HTTP Conformance for the Entire API Lifecycle'
date: 2026-04-20T00:00:00Z
authors:
  - 'peterMuller'
tags:
  - announcement
  - release
excerpt: 'APIs routinely violate HTTP protocol requirements — causing broken caching, request smuggling, and security vulnerabilities that surface in production. Today we release Thymian, an open-source HTTP conformance engine that detects protocol-level drift across your entire API lifecycle. One rule set, every stage, zero drift.'
---

Today, we are excited to announce the release of **Thymian**!

Most API tools answer one question: does the response match the schema? Almost none ask a more fundamental one: does this API correctly implement HTTP?

APIs routinely violate protocol requirements around caching headers, conditional requests, content negotiation, status codes, and method semantics. These violations can cause performance, interoperability and security issues such as broken CDN Caching, HTTP Request Smuggling, Cache Poisoned Denial-of-Service, Web Cache Deception — that surface not in development but in production, when the cost is highest.

The few tools that do check HTTP conformance, such as REDbot or h2spec, operate on a single URL at a time, reference outdated specifications, and offer no integration into modern development workflows. None of them consider the complete API, its resources, their relations, or the complex flows between them. **So, we built Thymian to close this gap.**

## What Is Thymian?

Thymian is an open-source, language-agnostic HTTP conformance and API governance engine. It validates your APIs against RFC standards and your OpenAPI specification — statically, against live endpoints, and in recorded production traffic.

The project originated as a master's thesis at the University of Würzburg and Technical University of Applied Sciences Würzburg-Schweinfurt, developed with academic rigor and a clear goal: build the HTTP conformance tool that the ecosystem is missing. It is now available as **v0.1** on [npm](https://www.npmjs.com/package/thymian) and [GitHub](https://github.com/thymianofficial/thymian), built and maintained by [qupaya](https://qupaya.com).

## Three Modes, One Rule

Thymian operates in three distinct execution modes; and the same rule works in all of them:

- **`thymian lint`** — Static analysis of OpenAPI specifications. No running server required. Catch issues before a single line of code is written.
- **`thymian test`** — Conformance testing against live API endpoints. Send real HTTP requests and validate the responses against RFC rules.
- **`thymian analyze`** — Analysis of recorded HTTP traffic. Validate captured production traffic against the same rules, without modifying your infrastructure.

Thymian adapts the execution context, while the rule logic remains the same. Just write your logic once, and validate it everywhere.

Thymian ships with **399 rules implementing RFC 9110** (HTTP Semantics), covering authentication, conditional requests, content negotiation, header field semantics, methods, status codes, range requests, and more. Each rule carries rich metadata: severity, RFC section reference, explanation, recommendation, and the specific HTTP participant it applies to — client, server, proxy, cache, or intermediary.

## API Drift — Beyond Schema Comparison

API drift is typically understood as the gap between what an API's specification describes and what the implementation actually does. Tools like Spectral, Dredd, Schemathesis, and Pact address this — but each covers only a single stage of the lifecycle, with its own rule format and its own scope:

| Stage      | Typical Tools             | Rule Format              |
| ---------- | ------------------------- | ------------------------ |
| Design     | Spectral, Bump.sh, Optic  | `.spectral.yml` rulesets |
| Dev/CI     | Dredd, Schemathesis, Pact | Test code, contracts     |
| Production | Treblle                   | Dashboard config         |

When a validation passes at design time but the same behavior breaks in production, there is no connection between the tools that could have caught it. Each stage is a silo.

Thymian eliminates this fragmentation. One rule set, applied consistently from specification review through live testing to production traffic analysis. If a rule exists, it can be enforced at every stage without re-implementation, format translation, or coverage gaps between tools.

But Thymian also goes further. The entire landscape of API drift tooling focuses on **specification drift**: does the response body match the documented schema? None of these tools check **protocol semantics drift**: does this API correctly implement HTTP as defined in RFCs 9110 and 9111?

No existing tool validates whether a `HEAD` response carries the same headers as `GET` without a body. Whether a `405 Method Not Allowed` includes the required `Allow` header. Whether `ETag` and `If-None-Match` produce a correct `304 Not Modified` flow. Whether `Cache-Control` directives are semantically valid. Whether method safety and idempotency guarantees are upheld.

Thymian is currently the only tool that detects protocol-level drift, and it does so across the entire API lifecycle.

## API Governance Across the Lifecycle

HTTP conformance rules are governance rules. When an organization defines that all APIs must correctly implement conditional requests, or that caching headers must follow RFC 9111, those requirements apply at every stage — not just in a CI linter that runs once before merge.

Thymian enables this by treating rules as the single source of truth for API governance:

| Lifecycle Stage              | Thymian Mode       | What It Catches                                                                                   |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| **API Design / Spec Review** | `lint`             | Missing headers, incomplete schemas, wrong status codes in the OpenAPI document                   |
| **Development / CI**         | `test`             | Implementation drift — the live server deviates from specification and RFC requirements           |
| **Staging / QA**             | `test` + `analyze` | Integration drift — behavior changes when deployed behind proxies, load balancers, or CDNs        |
| **Production**               | `analyze`          | Production regressions — real traffic reveals violations that never appeared in test environments |

Rules are distributable as npm packages. `@thymian/rules-rfc-9110` ships with Thymian. Organizations can publish their own rule sets — `@your-org/api-standards` — containing company-specific governance rules that are enforced at every stage, in every team, with zero drift between what is checked in CI and what is validated in production.

**One rule. Every stage. Zero drift.**

## Built for Developer and AI Workflows

Thymian is CLI-first, designed for both human developers and AI agents:

- **`--no-interactive`** mode for deterministic, non-interactive execution in CI and agent workflows
- **Rich error context** — every violation includes the rule name, RFC reference, severity, exact location, explanation, and recommendation
- **Exit codes** and structured results for composable pipelines

Whether you work with GitHub Copilot, Cursor, Aider, or a local model, any tool that reads structured CLI output can consume Thymian's results and act on them.

## Everything Is a Plugin

Thymian follows a microkernel architecture. The core provides the event bus, plugin lifecycle, and rule engine. Everything else, like OpenAPI parsing, HTTP linting, live testing, traffic analysis, report formatting, request dispatching, is a plugin.

Eight official plugins ship with Thymian. Custom plugins can be written in TypeScript or, via the WebSocket proxy plugin, in any programming language. Rules are authored with a type-safe fluent builder and can be shared as npm packages. Plugin communication is event-driven and loosely coupled. You can extend or replace any component without modifying framework code.

## Get Started

Run your first conformance check. No installation required:

```bash
npx thymian lint --spec openapi:openapi.yaml
```

Thymian will validate your OpenAPI specification against RFC 9110 rules and report any conformance violations with explanations, RFC references, and recommendations for fixing them.

## What's Next

Thymian v0.1.x is the foundation. Upcoming work includes expanded RFC coverage (RFC 9111 caching semantics and beyond), more integrations, and continued growth of the rule and plugin ecosystem.

- [Documentation](https://thymian.dev)
- [GitHub](https://github.com/thymianofficial/thymian)
- [Discord](https://discord.gg/TRSwCxbz9f) — join the community
- [Enterprise Consulting](https://thymian.dev/enterprise) — professional support from the creators of Thymian
