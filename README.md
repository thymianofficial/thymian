<div align="center">
  <img src="./astro-docs/src/assets/logo.svg" alt="Thymian Logo" width="200"/>

# Thymian

**Add resilience and HTTP conformance to your API development workflow**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-green.svg)](./LICENSE)
[![CI](https://github.com/thymianofficial/thymian/actions/workflows/ci.yaml/badge.svg)](https://github.com/thymianofficial/thymian/actions/workflows/ci.yaml)
[![Documentation](https://img.shields.io/badge/docs-thymian.dev-green.svg)](https://thymian.dev)
[![Discord](https://img.shields.io/discord/1440702693768429791?logo=discord&label=Discord&color=5865F2)](https://discord.gg/TRSwCxbz9f)
[![Reddit](https://img.shields.io/badge/Reddit-ThymianOfficial-FF4500?logo=reddit)](https://www.reddit.com/r/ThymianOfficial/)
[![Twitter](https://img.shields.io/badge/Twitter-@thymiandev-1DA1F2?logo=x)](https://x.com/thymiandev)

</div>

Thymian is a language-agnostic, open-source **HTTP conformance and API governance tool**. It validates your APIs against RFC standards and your OpenAPI specification out of the box, statically, against live endpoints, and in recorded production traffic. Fully extensible with plugins and shareable custom rules that you write once and run everywhere.

## Key Capabilities

- **Standards-First** — Validates against RFC 9110 and related HTTP specifications
- **Write Once, Validate Everywhere** — A single rule definition works across `thymian lint`, `thymian test`, and `thymian analyze`
- **Multi-Layer Governance** — Validates HTTP infrastructure, protocol compliance, technical implementation, and organizational guidelines
- **Educational Reporting** — Violations explain the RFC semantics and real-world consequences, not just pass/fail
- **Production-Aware** — Monitors how proxies, CDNs, and load balancers affect HTTP semantics in real deployments
- **Language-Agnostic & Extensible** — Works with any tech stack; custom rules distributable as npm packages, remote plugins via WebSocket

## 🚀 Quick Installation

### Installation

You won't need to install Thymian locally, we will just use `npx` for this.

Check if you can run Thymian by running the following command:

```bash
npx thymian --version
```

### First Run Without a Config

Now navigate to your project's root directory and run Thymian directly against your API description:

```bash
npx thymian lint --spec openapi:openapi.yaml
```

This is the fastest way to reach a first conformance result without any prior setup.

### Generate a Reusable Config

If you want to save that setup for future runs, generate a config file:

```bash
npx thymian generate config
```

This command detects your OpenAPI specification file and creates a `thymian.config.yaml` you can reuse with `npx thymian lint`.

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
