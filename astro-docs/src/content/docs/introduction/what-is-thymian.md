---
title: 'What is Thymian?'
description: 'Thymian is an extensible and plugin-rich tool to lint and test HTTP endpoints and APIs.'
sidebar:
  order: -1
---

Thymian is an innovative open-source HTTP conformance linting tool that revolutionizes how developers build, test, and
maintain APIs. By combining static analysis with runtime testing capabilities, Thymian ensures your APIs follow industry
best practices and RFC/IETF standards throughout the entire development lifecycle.

**Thymian is not yet another tool in your API toolbox. It's the toolbox!**

## Why Thymian?

The web has been evolving rapidly since decades. Software as a Service (SaaS) has become the norm,
and countless apps and platforms rely on critical services and APIs. Mobile devices work as digital
wallets, and almost everybody is connected 24/7 to the internet.

Virtually everything relies on one communication standard: the **Hypertext Transfer Protocol** or short **HTTP**

HTTP plays a key role in practically every aspect in our digital life and is designed to be
**secure, reliable, and fast.** HTTP brings complimentary and can reduce complexity on the API and client level
when implemented properly.

Thymian is here to help you build and maintain high-quality APIs and HTTP-based communication that follow industry
standards and keep your business logic simple and secure by ensuring compliance with HTTP standards.

## Comprehensive API Testing & Validation

At its core, Thymian provides powerful API analysis through multiple complementary approaches:

- **Static Analysis**: Catch issues early by analyzing API specifications at design time
- **Runtime Linting**: Validate actual API behavior and responses during execution
- **OpenAPI Support**: First-class support for OpenAPI specifications enables thorough API contract validation
- **HTTP Conformance**: Ensure your APIs properly implement HTTP standards and best practices

## Flexible & Extensible Architecture

Thymian is built on a modern, plugin-based microkernel architecture that enables extensive customization:

- **Plugin System**: Extend functionality through WebSocket-based plugins
- **Custom Rulesets**: Create and share HTTP conformance rules and tests (similar to ESLint)
- **Custom Plugins**: Build plugins to add new capabilities and integrations

## Developer-Focused Experience

We've designed Thymian with developers in mind:

- **CLI Interface**: Powerful command-line tools for automation and CI/CD integration
- **IDE Integration**: Direct integration with popular IDEs like IntelliJ and WebStorm
- **API Testing**: Built-in support for payload/data seeding and sharable test cases
- **Framework Agnostic**: Works with any API implementation and technology stack (e.g., Node.js, NestJS, Express,
  Spring Boot, etc.)

## Enterprise Ready

Thymian bridges the gap between development and production:

- **Complete Toolchain**: Seamlessly connects static analysis, contract testing, and runtime validation
- **API Governance**: Enforce standards and best practices across your organization
- **AGPL Licensed**: Free for commercial use while ensuring code remains open source
- **Production Grade**: Built for reliability and performance at scale

By serving as the bridge between static specification linting, contract testing, and runtime testing, Thymian provides a
comprehensive solution for modern API development. Whether you're building new APIs or maintaining existing ones,
Thymian helps ensure quality, consistency, and compliance with HTTP standards.

## Real-World Use Cases

Thymian detects concrete, real-world problems that occur when HTTP implementations deviate from standards — from [request smuggling](/concepts/use-cases/request-smuggling-via-content-length/) and [cache poisoning](/concepts/use-cases/cache-poisoning-via-missing-vary/) to [duplicate charges from unsafe retries](/concepts/use-cases/duplicate-operations-from-unsafe-retries/) and [silent data loss from missing conditional requests](/concepts/use-cases/lost-update-problem/). See the full catalog of [use cases covered by RFC 9110 rules](/concepts/use-cases/).
