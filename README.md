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

Thymian is an innovative, language-agnostic open-source library that revolutionizes **API development** by combining **resilience testing and HTTP conformance linting** into a single, robust workflow. By integrating static analysis with runtime testing, it ensures your APIs strictly adhere to **RFC/IETF standards and industry best practices** throughout their entire lifecycle.

## Key Capabilities:

- **Standards-First:** Validates against official HTTP specifications.
- **API Lifecycle Testing:** Apply the same rules from static analysis to runtime testing and traffic analysis.
- **Language-Agnostic:** Built to fit into any tech stack without friction.
- **Extensible:** Easily customize your analysis with custom rules and plugins.

## 🚀 Quick Installation

### Installation

You won't need to install Thymian locally, we will just use `npx` for this.

Check if you can run Thymian by running the following command:

```bash
npx @thymian/cli --version
```

### First Run Without a Config

Now navigate to your project's root directory and run Thymian directly against your API description:

```bash
npx @thymian/cli lint --spec openapi.yaml
```

This is the fastest way to reach a first conformance result without any prior setup.

### Generate a Reusable Config

If you want to save that setup for future runs, generate a config file:

```bash
npx @thymian/cli generate config
```

This command detects your OpenAPI specification file and creates a `thymian.config.yaml` you can reuse with `npx @thymian/cli lint`.

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

**[Learn more about Enterprise Support](https://thymian.dev/enterprise)** | **Email: [support@thymian.dev](mailto:support@thymian.com)**

---

<div align="center">

**Shipped with 🌱 by [qupaya](https://qupaya.com)**

</div>
