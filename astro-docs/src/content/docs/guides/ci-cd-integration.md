---
title: CI/CD Integration
description: Run Thymian in your continuous integration and deployment pipelines
---

Thymian's CLI commands are non-interactive by default and return structured exit codes, making them ideal for automated quality gates in CI/CD pipelines.

## Exit Codes

| Code | Meaning                               |
| ---- | ------------------------------------- |
| `0`  | All checks passed                     |
| `1`  | One or more violations found          |
| `2`  | Thymian encountered an internal error |

## Quick Start

Add Thymian to your pipeline with a single step:

```bash
npx thymian lint
```

This reads your `thymian.config.yaml` and reports violations. A non-zero exit code fails the pipeline step automatically.

## GitHub Actions

```yaml
name: API Quality
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx thymian lint
```

### Running Multiple Commands

Use separate steps for each command so failures are visible individually:

```yaml
steps:
  - run: npx thymian lint
    name: Static Analysis
  - run: npx thymian test --target-url ${{ vars.API_URL }}
    name: HTTP Conformance Tests
```

## GitLab CI

```yaml
thymian-lint:
  image: node:22
  script:
    - npm ci
    - npx thymian lint
```

## Best Practices

1. **Pin your Thymian version** — Use a lockfile (`package-lock.json` / `pnpm-lock.yaml`) so every pipeline run uses the same version.
2. **Start with `lint`** — Static analysis is fast and catches specification issues without a running API.
3. **Add `test` for integration** — When a live API is available in CI (e.g., via Docker Compose), add `thymian test --target-url <url>` to validate runtime behavior.
4. **Control severity** — Use the `--rule-severity` flag or the `ruleSeverity` config option to decide which findings block the build.
5. **Cache `node_modules`** — Speeds up repeated runs significantly.
