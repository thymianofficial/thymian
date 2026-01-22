---
title: 'Use linting to validate your APIs'
description: 'Validate HTTP APIs across design, testing, and production with reusable rules.'
sidebar:
  order: 0
---

The **@thymian/http-linter** enables you to validate HTTP APIs at every stage of development—from design and implementation to testing and production monitoring. Write validation rules once and apply them across static specifications, live API tests, and recorded traffic analysis.

## Why HTTP Linting?

Modern API development faces several challenges:

- **API drift** between specification and implementation
- **Inconsistent behavior** across endpoints and versions
- **Compliance issues** with HTTP standards or internal guidelines
- **Breaking changes** that affect clients

HTTP linting addresses these challenges by providing automated validation that runs throughout your development lifecycle.

## Key Features

- **Write once, validate everywhere** — Rules work across static specs, live tests, and traffic analysis
- **Powerful filter DSL** — Declaratively match HTTP requests and responses
- **Type-safe** — Full TypeScript support with IDE autocomplete
- **Extensible** — Create and share custom rule sets as npm packages
- **CLI tools** — Generate, search, and manage rules from the command line

## Quick Start

Here's a simple custom rule that enforces API versioning across your organization:

```typescript
import { httpRule } from '@thymian/http-linter';
import { path, not } from '@thymian/core';

export default httpRule('api-must-include-version-in-path')
  .severity('error')
  .type('static', 'analytics')
  .description('All API endpoints must include /v{number}/ in path for versioning')
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(path('/api/'), not(path('/api/v\\d+/'))))
  .done();
```

This custom organizational rule automatically validates:

- **Static specs** — Checks OpenAPI definitions during design
- **Traffic analysis** — Validates recorded HTTP transactions from production

## Use Cases

### Prevent API Drift

Validate that your running API matches its specification by applying the same rules to both:

```typescript
// Rule validates both spec and implementation
.type('static', 'test')
```

### Enforce API Governance

Create organization-wide rules for consistent API behavior:

```typescript
// Ensure all authenticated endpoints include rate limit headers
httpRule('authenticated-endpoints-must-include-rate-limits')
  .type('analytics', 'test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(and(authorization(), successfulStatusCode()), not(responseHeader('x-ratelimit-remaining'))))
  .done();
```

### Validate Production Traffic

Analyze recorded traffic to detect issues in production:

```typescript
// Analytics-only rule for production monitoring
.type('analytics')
```

## How It Works

```mermaid
graph LR
    A[HTTP Rule] --> B[Static Context]
    A --> C[Test Context]
    A --> D[Analytics Context]

    B --> E[Validates OpenAPI Spec]
    C --> F[Generates & Runs Tests]
    D --> G[Analyzes Recorded Traffic]

    E --> H[Reports Violations]
    F --> H
    G --> H
```

The HTTP linter provides three validation contexts, each suited for different stages of development:

1. **Static** — Fast validation against API specifications
2. **Test** — Active testing of live endpoints
3. **Analytics** — Passive analysis of recorded HTTP traffic

Rules can target one or more contexts, and the linter automatically adapts the validation logic to each context.

## Documentation

1. [What is an HTTP Rule?](../../concepts/what-is-an-http-rule.md) — Core concepts and rule anatomy
2. [Creating New Rules](creating-new-rules.md) — Step-by-step guide to writing rules
3. [Rule Types](../../references/plugins/http-linter/rule-types.md) — Understanding static, test, and analytics contexts
4. [Combining Different Rule Types](combining-types.md) — Writing hybrid rules
5. [How To Use Rules](how-to-use-rules.md) — Integration and configuration
6. [CLI](../../references/plugins/http-linter/cli.md) — Command-line tools reference

## Next Steps

- Learn about [HTTP rule fundamentals](../../concepts/what-is-an-http-rule.md)
- Follow the guide to [create your first rule](creating-new-rules.md)
- Explore the [CLI tools](../../references/plugins/http-linter/cli.md) for rule generation and management
