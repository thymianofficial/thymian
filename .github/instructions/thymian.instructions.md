---
applyTo: '**'
---

## Thymian Workspace Overview

Thymian is a monorepo managed with Nx, organized into several packages under the `packages/` directory.

### Key Conventions

- All packages use TypeScript and Nx for builds, tests, and linting.
- Plugins and libraries are decoupled for extensibility.
- The workspace uses strict linting, formatting, and commit conventions.
- Core functionality is extended via the plugin system in `core/`.

## Plugin Architecture

Thymian is built around a highly extensible plugin system—virtually everything is a plugin. Core features, integrations, and extensions are implemented as plugins, which are registered and orchestrated by the framework.

- **Core Plugins**: Fundamental features (e.g., event handling, validation, reporting) are implemented as plugins in the `core/` package.
- **Official Plugins**: Additional functionality (e.g., format validation, HTTP linting, OpenAPI support) is provided via plugins in the `plugins/` directory.
- **Custom Plugins**: Developers can create their own plugins to extend or override core behavior, add new rules, or integrate with external systems.
- **Plugin Registration**: Plugins are registered by the core. For each registered plugin an event (`core.register`) is emitted. This lets other plugins know which plugins are registered.
- **Decoupling**: Plugins interact through well-defined APIs and events, ensuring loose coupling and maximum extensibility.
- **Lifecycle**: Plugins can hook into core events, actions, and error flows, allowing deep integration and customization.

This architecture allows Thymian to be flexible, modular, and easy to extend for a wide range of use cases.

## Event Architecture

Thymian uses a reactive event-driven architecture at its core. The main components are:

- **ThymianEmitter**: Central event bus for dispatching and listening to events, actions, and errors.
- **Events**: Defined in `core/src/events/`, including core events like `core.error`, `core.register`, and `core.report`. Events operate in a fire-and-forget manner.
- **Actions**: Action events and responses are used when a response to an event is required. Performs and wait and block unit the corresponding response event(s) are received.
- **Error Events**: Errors are propagated as structured events, supporting correlation and tracing.
- **Event Types**: All events have unique IDs, names, payloads, timestamps, and sources for traceability. And a response event also has a correlation ID that uniquely associates the response with an event.
- **Utilities**: Helper functions for event type guards and correlation.

This architecture enables extensibility, plugin integration, and robust error handling across the monorepo.

---

## Shared Rules Architecture

Thymian supports sharing and reusing rules across plugins and libraries. For example:

- **Rule Libraries**: The `libs/rfc-9110-rules` package provides reusable HTTP rules based on RFC 9110, organized by fields, methods, and status codes.
- **Rule Sets**: Rules are grouped into sets (see `src/index.ts` in `rfc-9110-rules`) for easy integration with linters and validators.
- **Extensibility**: Plugins (e.g., `http-linter`) can consume these shared rule sets to enforce standards or add custom validation.
- **Utilities**: Helper functions and constants (e.g., field lists, array utilities) are provided for rule composition and reporting.

This approach enables consistent validation, extensibility, and code reuse throughout the Thymian ecosystem.
