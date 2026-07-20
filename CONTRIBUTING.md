# Contributing to Thymian

## Commit Message Scopes

When making commits, use one of the following scopes to indicate the area of the codebase your change affects:

> The authoritative list is `scope-enum` in [commitlint.config.js](commitlint.config.js) —
> commits with any other (or no) scope are rejected by the commit hook. Keep this table in
> sync when adding or renaming packages.

| Scope                            | Description                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| repo                             | Repository-wide configuration, tooling, workflows, or docs (incl. the Astro docs site) |
| release                          | Release tooling and pipelines                                                          |
| deps                             | Dependency updates and changes                                                         |
| cli                              | Cross-cutting CLI concerns                                                             |
| thymian                          | The `thymian` CLI product package                                                      |
| common-cli                       | Shared CLI base library (`@thymian/common-cli`)                                        |
| core                             | Core framework: workflows, contracts, rule system (`@thymian/core`)                    |
| core-testing                     | Test utilities for core (`@thymian/core-testing`)                                      |
| plugin-http-linter               | Static lint plugin                                                                     |
| plugin-http-tester               | Live HTTP testing plugin                                                               |
| plugin-http-analyzer             | Traffic analysis plugin                                                                |
| plugin-har                       | HAR loader plugin                                                                      |
| plugin-openapi                   | OpenAPI loader plugin                                                                  |
| plugin-reporter                  | Report file formatters plugin                                                          |
| plugin-request-dispatcher        | HTTP request dispatch plugin                                                           |
| plugin-sampler                   | Sample/request generation plugin                                                       |
| plugin-websocket-proxy           | WebSocket remote-plugin transport                                                      |
| rules-rfc-9110                   | RFC 9110 rule set                                                                      |
| rules-api-description-validation | API description validation rule set                                                    |
| e2e                              | End-to-end test workspace                                                              |

Use these scopes in your commit messages for clarity and traceability.

Example commit message:

```
feat(core): add new event bus for plugin registration
```

Refer to this list when contributing to ensure consistent commit messages.

## Module boundaries

> Enforced by `@nx/enforce-module-boundaries` in [eslint.config.mjs](eslint.config.mjs) —
> that file is the source of truth.

### Dimension "scope"

| Tag            | Allowed Dependencies                                     | Description                                                                                                         |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `scope:cli`    | `scope:core`, `scope:cli`, `scope:plugin`, `scope:rules` | CLI packages (the `thymian` app aggregates plugins and rule sets)                                                   |
| `scope:core`   | `scope:core`                                             | Core framework (contracts, rule system, Thymian format)                                                             |
| `scope:plugin` | `scope:core`, `scope:cli`, `scope:plugin`                | Plugins (note: plugins may **not** depend on `scope:rules` — rules reach plugins via the core loader, per ADR-0009) |
| `scope:rules`  | constrained via `type`/`npm` dimensions                  | Rule set packages; depend only on `@thymian/core` in practice                                                       |

### Dimension "type"

| Tag                | Allowed Dependencies           | Description                                                                                                  |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `type:app`         | All types                      | Executable packages or nx apps                                                                               |
| `type:lib`         | `type:lib`                     | A library                                                                                                    |
| `type:lib-feature` | `type:lib`, `type:lib-feature` | Features add functionality to libraries. E.g. publishable config, rule-sets or just splitted out source code |
| `type:e2e`         | All types                      | End-to-end tests and testing utilities                                                                       |

In **test files** (`**/test/**`, `*.test.ts`, `*.spec.ts`) every constraint additionally
allows `type:testing`, so testing libraries are reachable from any project's tests without
being a production dependency.

### Dimension "npm"

| Tag           | Allowed Dependencies        | Description                                              |
| ------------- | --------------------------- | -------------------------------------------------------- |
| `npm:public`  | `npm:public`                | Published packages may only depend on published packages |
| `npm:private` | `npm:public`, `npm:private` | Private projects may depend on anything                  |

## Releases

### Overview

Thymian uses a three-tier release system:

1. **Canary releases** - Automatic, triggered on every push to `main`
2. **Latest releases** - Interactive, manually triggered with approval gates
3. **Local releases** - For testing with local registry

### Release Types

#### Canary Release (Automatic)

Triggered automatically on every push to `main`:

```bash
# Happens automatically via GitHub Actions
# Publishes to npm with dist-tag `canary`
# Version format: X.Y.Z-canary.YYYYMMDD-{hash}
```

**Skip canary release**: Include `[skip-canary]` in commit message.

#### Latest Release (Interactive)

For production releases with approval gates:

```bash
# Step 1: Preview what the release will look like (optional)
node ./scripts/release.ts --dist-tag latest --no-local --dry-run

# Step 2: Create the release (interactive)
node ./scripts/release.ts --dist-tag latest --no-local --no-dry-run

# Or with an explicit version:
node ./scripts/release.ts --dist-tag latest --version 1.2.3 --no-local --no-dry-run

# The script will:
# - Calculate version from conventional commits (or use explicit --version)
# - Show version and changelog
# - Ask for your confirmation
# - Create git tag and GitHub Release (if confirmed)
# - Trigger CI to publish to npm
```

**What happens:**

1. Script determines next version using conventional commits
2. Displays version and project list, then prompts for confirmation
3. On approval: creates git tag and GitHub Release
4. GitHub Release triggers CI workflow
5. CI workflow publishes to npm (requires environment approval)

**Authorization**: Only users in `VALID_AUTHORS_FOR_LATEST` in [scripts/release.ts](scripts/release.ts) can publish to npm.

#### Local Release (Testing)

For testing with local Verdaccio registry:

```bash
# Start local registry
npm run local-registry

# In another terminal, publish to local registry with latest dist-tag
node ./scripts/release.ts --dist-tag latest --version patch --no-dry-run

# Or specify exact version
node ./scripts/release.ts --dist-tag latest --version 1.2.3 --no-dry-run

# Test canary locally
node ./scripts/release.ts --dist-tag canary --version 1.2.3 --local --no-dry-run
```

#### Bootstrapping New Packages on npm

When you add a **new** `@thymian/*` package to the monorepo, it must be published once manually before CI can use trusted publishing (OIDC). The `bootstrap-npm-packages` script handles this:

```bash
# 1. Log in to npm (one-time, needs publish rights on the @thymian scope)
npm login

# 2. Build the new package(s)
npx nx run-many -t build

# 3. Dry-run (default) — see what would be published
npm run bootstrap-npm-packages

# 4. Publish for real
npm run bootstrap-npm-packages -- --no-dryRun
```

The script will:

1. Detect all `@thymian/*` workspace packages that don't exist on npm yet
2. Publish each one as a canary version (using the latest canary version from already-published packages by default)
3. Print npm settings links and exact form values for configuring **trusted publishing** on each new package

You can also target specific packages or override the canary version:

```bash
# Publish only specific packages
npm run bootstrap-npm-packages -- --no-dryRun -p @thymian/my-new-package

# Override the canary version
npm run bootstrap-npm-packages -- --no-dryRun -v 1.2.3-canary.20260420-abc1234
```

After publishing, follow the printed instructions to add trusted publishing in the npm UI so CI can take over future releases.

### CLI Options

| Option             | Description                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `--dist-tag`, `-t` | **Required.** npm dist-tag to publish with (`canary` or `latest`)                                                     |
| `--version`, `-v`  | Explicit version specifier (e.g., `1.2.3`, `patch`, `minor`, `major`). If omitted, derived from conventional commits. |
| `--dry-run`, `-d`  | Preview changes without executing (default: `true`)                                                                   |
| `--no-dry-run`     | Execute changes for real                                                                                              |
| `--local`          | Publish to local Verdaccio registry (default: `true`)                                                                 |
| `--no-local`       | Publish to npm                                                                                                        |
| `--first-release`  | Treat as first release for the workspace                                                                              |
| `--verbose`        | Enable verbose logging (default: `true`)                                                                              |

### Release Workflow for Maintainers

```bash
# 1. Ensure all changes are merged to main
git checkout main && git pull

# 2. Preview the release (optional but recommended)
node ./scripts/release.ts --dist-tag latest --no-local --dry-run

# 3. Create the release (interactive, will ask for approval; requires --no-dry-run to actually execute)
node ./scripts/release.ts --dist-tag latest --no-local --no-dry-run
# Review the version and changelog
# Type 'yes' to confirm

# 4. Wait for GitHub Release to be created
# 5. CI will trigger and wait for environment approval
# 6. Approve the deployment in GitHub Actions
# 7. Release is published to npm
```

### CI/CD Pipeline

#### Canary Release Workflow

**Trigger:** Push to `main` (skip with `[skip-canary]`)

**Steps:**

1. Build all packages
2. Version with canary format
3. Create changelog
4. Publish to npm with dist-tag `canary`
5. Requires `npm` environment approval

#### Latest Release Workflow

**Trigger:** GitHub Release published

**Steps:**

1. Extract version from release tag
2. Checkout repository at release tag
3. Build all packages
4. Validate user is in allowlist
5. Publish to npm with dist-tag `latest`
6. Requires `npm` environment approval

### Release Configuration

Release behavior is configured in [nx.json](nx.json):

```json
{
  "release": {
    "git": {
      "tag": true,
      "commit": false,
      "stageChanges": false
    },
    "changelog": {
      "createRelease": "github"
    }
  }
}
```

### Troubleshooting

#### "Unauthorized user for latest release"

Your GitHub username is not in `VALID_AUTHORS_FOR_LATEST`. Contact a maintainer to be added.

#### "Local verdaccio is not running"

```bash
npm run local-registry
```

#### "No release needed"

No commits since last release match conventional commit format or no changes detected.

#### CI publish fails

Check:

1. `npm` environment is configured with approval gates
2. npm **trusted publishing (OIDC)** is configured for every published package — the
   workflow uses `id-token: write` and no npm token (`NODE_AUTH_TOKEN` is deliberately
   empty); brand-new packages need a one-time `npm run bootstrap-npm-packages`
3. User is in allowlist
4. Release tag format is valid semver

### ADR Compliance

This release system follows [ADR-0005](docs/arc42/adr/0005-tags-over-source-version-bumps.md) - no version commits are created. Version information lives only in git tags and GitHub Releases.
