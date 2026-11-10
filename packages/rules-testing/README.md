<!-- HEADER:START - Do not remove or modify this section -->
<div align="center">
  <img src="https://raw.githubusercontent.com/thymianofficial/thymian/main/astro-docs/src/assets/logo.svg" alt="Thymian Logo" width="200"/>

# Thymian

**Add resilience and HTTP conformance to your API development workflow**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-green.svg)](https://github.com/thymianofficial/thymian/blob/main/LICENSE)
[![CI](https://github.com/thymianofficial/thymian/actions/workflows/ci.yaml/badge.svg)](https://github.com/thymianofficial/thymian/actions/workflows/ci.yaml)
[![Documentation](https://img.shields.io/badge/docs-thymian.dev-green.svg)](https://thymian.dev)
[![Discord](https://img.shields.io/discord/1440702693768429791?logo=discord&label=Discord&color=5865F2)](https://discord.gg/TRSwCxbz9f)
[![Reddit](https://img.shields.io/badge/Reddit-ThymianOfficial-FF4500?logo=reddit)](https://www.reddit.com/r/ThymianOfficial/)
[![Twitter](https://img.shields.io/badge/Twitter-@thymiandev-1DA1F2?logo=x)](https://x.com/thymiandev)

</div>

## @thymian/rules-testing

`@thymian/rules-testing` runs one rule in one validation context through that context's real engine: the linter's, the tester's and the analyzer's own, driven by `runRules` from `@thymian/core` exactly as each plugin drives it. A passing test therefore shows that the rule is evaluated in that context, not only that the rule function works.

It returns results and verdicts rather than asserting, so your test framework makes the assertions.

## Installation

Install it with the plugin for every context your rule set declares. The plugins are optional peers, loaded only when their context runs:

```bash
npm install --save-dev @thymian/rules-testing @thymian/plugin-http-linter @thymian/plugin-http-tester @thymian/plugin-http-analyzer
```

Running a context whose plugin is not installed rejects with an error naming it, for example "the `test` context needs `@thymian/plugin-http-tester`".

## Example

```typescript
import { httpRule, responseHeader, ThymianFormat } from '@thymian/core';
import { checkInput, runInContext } from '@thymian/rules-testing';

const rule = httpRule('my-rules/no-server-header')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(responseHeader('server')))
  .done();

// What the rule reported, as `RuleFnResult[]`.
const results = await runInContext('static', rule, { format: new ThymianFormat() });

// Whether an input keeps the promise of a fixture: `violates`, `conforms` or `skips`.
const { met, reason } = await checkInput('static', rule, { format: new ThymianFormat() }, 'conforms');
```

Every input also takes `config`, the rule's configuration as a Thymian config file gives it (a severity, or `{ severity, type, skipOrigins, options }`), and `logger`. A rule shipped `off` runs at `warn` unless `config` gives it a severity.

## Validation contexts

The context names follow the rule types you write in `httpRule().type(...)`:

| Context     | Plugin                          | CLI command       |
| ----------- | ------------------------------- | ----------------- |
| `static`    | `@thymian/plugin-http-linter`   | `thymian lint`    |
| `test`      | `@thymian/plugin-http-tester`   | `thymian test`    |
| `analytics` | `@thymian/plugin-http-analyzer` | `thymian analyze` |

See the [Testing rules](https://thymian.dev/guides/http-rules/testing-rules) guide for writing fixtures and running them.

<!-- FOOTER:START - Do not remove or modify this section -->

## 📚 Documentation

- **[Getting Started](https://thymian.dev/introduction/getting-started)** - Set up Thymian in minutes
- **[Documentation](https://thymian.dev)** - Comprehensive guides and API reference
- **[CLI Reference](https://thymian.dev/references/cli)** - Complete CLI command documentation
- **[HTTP Rules](https://thymian.dev/guides/http-rules/how-to-use-rules)** - Learn about HTTP conformance validation

## 🏢 Enterprise Support

Get professional consulting and dedicated support from the creators of Thymian. We offer:

- API design and governance strategies
- HTTP standards compliance auditing
- Custom plugin development
- Custom rule development
- Team training and workshops

**[Learn more about Enterprise Support](https://thymian.dev/enterprise)** | **Email: [support@thymian.dev](mailto:support@thymian.dev)**

---

<div align="center">

**Shipped with 🌱 by [qupaya](https://qupaya.com)**

</div>
<!-- FOOTER:END -->
