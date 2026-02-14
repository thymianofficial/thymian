<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

## Thymian Workspace Overview

Thymian is a monorepo managed with Nx, organized into several packages under the `packages/` directory.

### Key Conventions

- All packages use TypeScript and Nx for builds, tests, and linting.
- Plugins and libraries are decoupled for extensibility.
- The workspace uses strict linting, formatting, and commit conventions.
- Core functionality is extended via the plugin system in `packages/core/`.

## Plugin Architecture

Thymian is built around a highly extensible plugin system—virtually everything is a plugin. Core features, integrations, and extensions are implemented as plugins, which are registered and orchestrated by the framework.

- **Core Framework**: The `packages/core/` package provides the fundamental framework infrastructure including ThymianEmitter, event system, plugin interfaces, and base types.
- **Official Plugins**: Additional functionality (e.g., format validation, HTTP linting, OpenAPI support, reporting) is provided via plugins in separate packages under `packages/`.
- **Custom Plugins**: Developers can create their own plugins to extend or override core behavior, add new rules, or integrate with external systems.
- **Plugin Registration**: Plugins are registered by the core framework. For each registered plugin an event (`core.register`) is emitted. This lets other plugins know which plugins are registered.
- **Decoupling**: Plugins interact through well-defined APIs and events, ensuring loose coupling and maximum extensibility.
- **Lifecycle**: Plugins can hook into core events, actions, and error flows, allowing deep integration and customization.

This architecture allows Thymian to be flexible, modular, and easy to extend for a wide range of use cases.

## Event Architecture

Thymian uses a reactive event-driven architecture at its core. The main components are:

- **ThymianEmitter**: Central event bus for dispatching and listening to events, actions, and errors.
- **Events**: Defined in `packages/core/src/events/`, including core events like `core.error`, `core.register`, `core.report`, and `core.exit`. Events operate in a fire-and-forget manner.
- **Actions**: Action events and responses are used when a response to an event is required. Performs and wait and block until the corresponding response event(s) are received.
- **Error Events**: Errors are propagated as structured events, supporting correlation and tracing.
- **Event Types**: All events have unique IDs, names, payloads, timestamps, and sources for traceability. And a response event also has a correlation ID that uniquely associates the response with an event.
- **Utilities**: Helper functions for event type guards and correlation.

This architecture enables extensibility, plugin integration, and robust error handling across the monorepo.

---

## Shared Rules Architecture

Thymian supports sharing and reusing rules across plugins and libraries. For example:

- **Rule Libraries**: The `packages/rfc-9110-rules` package provides reusable HTTP rules based on RFC 9110, organized by fields, methods, and status codes.
- **Rule Sets**: Rules are grouped into sets (see `src/index.ts` in `rfc-9110-rules`) for easy integration with linters and validators.
- **Extensibility**: Plugins (e.g., `http-linter`) can consume these shared rule sets to enforce standards or add custom validation.
- **Utilities**: Helper functions and constants (e.g., field lists, array utilities) are provided for rule composition and reporting.

This approach enables consistent validation, extensibility, and code reuse throughout the Thymian ecosystem.

---

## Deployment & Release

### Skipping Canary Deployment

To skip the canary release deployment for a commit, include `[skip-canary]` in the commit message:

```bash
git commit -m "docs: update documentation

[skip-canary]"
```

When this flag is present in the commit message pushed to `main`, the canary release workflow will be skipped, and no new version will be published to npm.
