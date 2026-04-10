# 8. Crosscutting Concepts

## 8.1 Events and Actions

Thymian uses a **reactive event-driven architecture** built on RxJS. The `ThymianEmitter` is the central event bus through which all components communicate. It supports two distinct messaging patterns:

### 8.1.1 Events (Fire-and-Forget)

Events are one-way notifications. The emitter dispatches an event and does not wait for a response.

- **`emit(name, payload)`** — Publish an event.
- **`on(name, handler)`** — Subscribe to an event.

Events are used for notifications that do not require acknowledgment, such as reporting results or announcing plugin registration.

| Event           | Payload                     | Purpose                                              |
| --------------- | --------------------------- | ---------------------------------------------------- |
| `core.register` | `{ name, events, options }` | Announces that a plugin has been registered          |
| `core.report`   | `ThymianReport`             | Carries structured validation results for formatting |
| `core.error`    | `ThymianErrorEvent`         | Propagates structured errors with correlation        |
| `core.exit`     | —                           | Signals system shutdown                              |

### 8.1.2 Actions (Request/Response)

Actions are blocking request/response pairs. The emitter dispatches an action event and waits for one or more response events before resolving.

- **`emitAction(name, payload, options)`** — Dispatch an action and await response(s).
- **`onAction(name, handler)`** — Register an action handler that receives the payload and a context object for replying.

The `ActionContext` provides:

- **`ctx.reply(payload)`** — Send a response back to the action emitter.
- **`ctx.error(error)`** — Signal an error for this action.

**Collection strategies** control how responses from multiple listeners are aggregated:

| Strategy       | Behavior                                          | Typical Use                                                             |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `'collect'`    | Wait for all listeners, return array of responses | Workflow actions (`core.lint`, `core.test`, `core.analyze`)             |
| `'first'`      | Return after first response                       | Infrastructure actions (`core.request.dispatch`, `core.request.sample`) |
| `'deep-merge'` | Deep-merge all responses into a single object     | Format broadcasting (`core.format`)                                     |

### 8.1.3 Action Naming Convention

All core-owned actions follow the hierarchical pattern **`core.<domain>.<verb>`**. See [ADR-0011](adr/0011-action-naming-conventions.md).

| Action                  | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `core.ready`            | Lifecycle: plugins are loaded and ready           |
| `core.close`            | Lifecycle: teardown and resource cleanup          |
| `core.format.load`      | Load API descriptions into ThymianFormat          |
| `core.format`           | Broadcast the loaded ThymianFormat to all plugins |
| `core.traffic.load`     | Load captured HTTP traffic data                   |
| `core.lint`             | Execute static linting of ThymianFormat           |
| `core.test`             | Execute live HTTP testing against a target server |
| `core.analyze`          | Execute analysis of captured HTTP traffic         |
| `core.request.dispatch` | Send an HTTP request and return the response      |
| `core.request.sample`   | Generate an HTTP request template from samples    |
| `core.report.flush`     | Flush buffered reports and return formatted text  |

### 8.1.4 Child Emitters

Each plugin receives a **child emitter** via `emitter.child(pluginName)`. Child emitters share the same underlying RxJS Subjects (events, responses, errors) and listener map, but stamp a distinct `source` on every event they emit. This enables per-plugin tracing without duplicating event infrastructure.

### 8.1.5 Event Lifecycle

All events carry structured metadata:

```typescript
{
  id: string; // Unique event ID (UUID)
  name: string; // Event or action name
  payload: unknown; // Typed payload
  timestamp: number; // Emission time
  source: string; // Emitting plugin name
}
```

Response events additionally carry a `correlationId` that ties the response back to the originating action event, enabling the emitter to match responses to their requests.

### 8.1.6 Error Propagation

Errors from event and action handlers are caught and wrapped in `ThymianBaseError` instances, then emitted on the dedicated `#errors` Subject. For actions, errors carry a `correlationId` linking them to the originating action. The `Thymian` class subscribes to errors via `emitter.onError()` and will trigger graceful shutdown for severity `'error'`.

## 8.2 Plugin Implementation

Thymian follows a **"everything is a plugin"** architecture. Core functionality, integrations, and extensions are all implemented as plugins.

### 8.2.1 Plugin Interface

A plugin is defined by the `ThymianPlugin<Options>` interface:

```typescript
type ThymianPlugin<Options> = {
  name: string; // Unique plugin name (e.g., "@thymian/plugin-http-linter")
  version: string; // Semver constraint for @thymian/core compatibility
  plugin: ThymianPluginFn<Options>; // Registration function
  options?: JSONSchemaType<Options>; // Optional JSON Schema for plugin options
  events?: ThymianPluginEvents; // Event declarations (provides, emits, listensOn)
  actions?: ThymianPluginActions; // Action declarations (provides, emits, requires, listensOn)
};
```

### 8.2.2 Plugin Lifecycle

1. **Registration:** The consumer calls `thymian.register(plugin, options)`. The `Thymian` class validates the semver version constraint and (if declared) the options against the plugin's JSON Schema.
2. **Loading:** During `ready()`, the core plugin is loaded first, then all registered plugins in order. Each plugin's `plugin()` function receives a child emitter, a logger, and the validated options. The plugin subscribes to events and actions during this phase.
3. **Announcement:** For each plugin, a `core.register` event is emitted so other plugins can react to the registration.
4. **Ready:** After all plugins are loaded, `core.ready` is emitted.
5. **Workflow:** The consumer invokes a workflow method (e.g., `lint()`), which dispatches actions that plugins respond to.
6. **Teardown:** `core.close` is emitted, and plugins clean up resources (e.g., close database connections, flush queues). The emitter then shuts down.

### 8.2.3 Plugin Declarations

Plugins declare their event and action relationships:

- **`provides`** — Actions or events that this plugin defines and owns.
- **`emits`** — Actions or events that this plugin will emit (but does not own).
- **`listensOn`** — Actions or events that this plugin will subscribe to.
- **`requires`** — Actions that this plugin depends on being available.

These declarations serve as documentation and enable runtime validation.

### 8.2.4 Core Plugin

The `corePlugin` is a special internal plugin that declares all core-owned actions and events. It is always loaded first and defines the contracts that other plugins implement. The core plugin itself has an empty `plugin()` function — its purpose is purely declarative.

## 8.3 Thymian Format

The **ThymianFormat** is Thymian's **protocol-agnostic intermediate representation** of API specifications. It serves as the shared data model that all validation plugins operate on.

### 8.3.1 Graph Model

ThymianFormat wraps a [graphology](https://graphology.github.io/) `MultiDirectedGraph` with typed nodes and edges. The graph model enables rich structural queries over API specifications.

**Node types:**

| Node Type              | Description                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `http-request`         | An API endpoint request (method, path, host, port, protocol, media type, parameters, schemas) |
| `http-response`        | An API endpoint response (status code, media type, headers, body schema)                      |
| `security-scheme`      | An authentication/authorization scheme (API key, bearer, OAuth2, etc.)                        |
| `sample-http-request`  | A sample HTTP request (used by the Sampler for test data)                                     |
| `sample-http-response` | A sample HTTP response                                                                        |

**Edge types:**

| Edge Type                 | Source → Target                                | Description                                                |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `http-transaction`        | `http-request` → `http-response`               | Links a request to its expected response                   |
| `http-link`               | `http-response` → `http-request`               | Hypermedia link between a response and a follow-up request |
| `is-secured`              | `http-request` → `security-scheme`             | Indicates that a request requires authentication           |
| `sample-http-transaction` | `sample-http-request` → `sample-http-response` | Sample data transaction                                    |
| `has-sample`              | `http-request`/`http-response` → sample node   | Links a format node to its sample data                     |

### 8.3.2 Serialization

ThymianFormat can be serialized via `format.export()` (returning a `SerializedThymianFormat`) and deserialized via `ThymianFormat.import(serialized)`. The serialized form includes a SHA-1 hash of all node and edge IDs for version tracking.

### 8.3.3 Node Identity

Nodes are identified by content-addressed SHA-1 hashes of their properties. This ensures that identical API elements have the same ID across different runs, enabling stable references and deduplication.

### 8.3.4 Format Loading

Format loading is plugin-driven via the `core.format.load` action. Currently, the OpenAPI plugin is the primary format loader — it parses OpenAPI documents and transforms them into ThymianFormat graphs. The architecture supports additional format loaders (e.g., for AsyncAPI, GraphQL) via the same action.

When multiple loaders respond, their formats are merged into a single graph.

### 8.3.5 Extensions

Nodes support an `extensions` record for loader-specific metadata. For example, the OpenAPI loader adds `extensions.openapi.operationId` to request nodes. Plugins can query nodes by extension values via `format.findNodeByExtension()`.

## 8.4 Rules and Rulesets

The **rule system** is a core concern in Thymian. Rules define validation logic for linting, testing, and analyzing HTTP APIs. The rule system is designed for reuse across all three validation modes.

### 8.4.1 Rule Definition

A rule is defined by the `Rule<Options>` type:

```typescript
type Rule<Options> = {
  lintRule?: RuleFn<LintContext, Options>; // Static analysis function
  analyzeRule?: RuleFn<AnalyzeContext, Options>; // Traffic analysis function
  testRule?: RuleFn<TestContext, Options>; // Live HTTP testing function
  meta: RuleMeta<Options>; // Rule metadata
};
```

A single rule can implement one, two, or all three mode functions. This allows rule authors to provide consistent validation across all modes from a single rule definition.

### 8.4.2 Rule Metadata

The `RuleMeta` type captures:

| Field            | Type                    | Description                                                                       |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `name`           | `string`                | Unique rule identifier                                                            |
| `type`           | `RuleType[]`            | Applicable modes: `'static'`, `'analytics'`, `'test'`, `'informational'`          |
| `severity`       | `RuleSeverity`          | Default severity: `'error'`, `'warn'`, `'info'`, `'off'`                          |
| `options`        | `JSONSchemaType`        | JSON Schema for rule-specific options                                             |
| `appliesTo`      | `HttpParticipantRole[]` | HTTP participant roles the rule targets (e.g., `'client'`, `'server'`, `'proxy'`) |
| `tags`           | `string[]`              | Categorization tags                                                               |
| `description`    | `string`                | Human-readable description                                                        |
| `summary`        | `string`                | Short violation message                                                           |
| `recommendation` | `string`                | Suggested fix                                                                     |
| `url`            | `string`                | Reference URL (e.g., RFC section)                                                 |

### 8.4.3 Rule Contexts

Each validation mode provides a specialized context to rule functions:

```
ApiContext (base)
├── LintContext           — Static analysis over ThymianFormat graph
├── LiveApiContext        — Base for modes that involve actual HTTP data
│   ├── TestContext       — Live HTTP testing with httpTest() pipeline
│   └── AnalyzeContext    — Post-hoc traffic analysis with captured data queries
```

**Common capabilities** (from `ApiContext`):

- `format` — Access to the ThymianFormat graph
- `report` — Emit structured reports
- `reportViolation()` — Report a rule violation
- `validateCommonHttpTransactions()` — Iterate transactions with a filter and validation function

**Mode-specific capabilities:**

- `LintContext`: `validateHttpTransactions()` with typed `ThymianHttpRequest`/`ThymianHttpResponse` parameters
- `TestContext`: `httpTest()` and `runHttpTest()` for pipeline-based live HTTP testing
- `AnalyzeContext`: `validateCapturedHttpTransactions()` and `validateCapturedHttpTraces()` for querying captured traffic

### 8.4.4 Rule Runner Adapter

The `RuleRunnerAdapter<Context>` is the core abstraction that allows the shared `runRules()` function to work across all three modes:

```typescript
type RuleRunnerAdapter<Context> = {
  errorName: string; // Error class name for this mode
  mode: 'static' | 'analytics' | 'test'; // Execution mode
  getRuleFn(rule: Rule): RuleFn | undefined; // Select the mode-specific function
  createContext(rule, options): Context; // Create mode-specific context
};
```

Each validation plugin (HTTP Linter, HTTP Tester, HTTP Analyzer) provides its own adapter implementation. See [ADR-0009](adr/0009-rule-system-as-core-concern.md).

### 8.4.5 Rule Sets

Rules are grouped into **rule sets** (`RuleSet`) for distribution and configuration:

```typescript
type RuleSet = {
  name: string; // Package name (e.g., "@thymian/rules-rfc-9110")
  url?: string; // Documentation URL
  options?: Record<string, unknown>;
  rules?: Rule[]; // Inline rules
  pattern?: string | string[]; // Glob patterns for rule discovery
};
```

Rule sets are loaded dynamically by the rule loader, which resolves package names, applies filters, and merges configurations. The two built-in rule set packages are:

- **`@thymian/rules-rfc-9110`** — HTTP rules based on RFC 9110 (methods, status codes, headers)
- **`@thymian/rules-api-description-validation`** — API description validation rules

### 8.4.6 Rule Configuration

Rules can be configured per-rule via `RulesConfiguration`:

```typescript
type RulesConfiguration = {
  [ruleName: string]: RuleSeverity | SingleRuleConfiguration;
};

type SingleRuleConfiguration = {
  skipOrigins?: string[];
  options?: Record<string, unknown>;
};
```

Setting a rule name to a severity level (e.g., `"off"`) overrides the default. Using `SingleRuleConfiguration` allows passing rule-specific options and skip patterns.

## 8.5 Release and Versioning Process

Thymian follows a tag-based release process that maintains clean version control history without committing version bumps (see [ADR-0005](adr/0005-tags-over-source-version-bumps.md)).

### 8.5.1 Release Types

**Canary Releases:**

- Automatically triggered on every push to `main` branch
- Published to npm with dist-tag `canary`
- Version format: `{base-version}-canary.{YYYYMMDD}-{git-hash}`
- Non-interactive, immediate publishing
- Skipped when commit message contains `[skip-canary]`

**Latest Releases:**

- Manually triggered by developers using `--dist-tag latest`
- Interactive approval flow with local review
- Published to npm with dist-tag `latest`
- Two-phase process: local creation of tag/release, CI publishing to npm
- Requires GitHub environment approval and allowlist validation

### 8.5.2 Latest Release Workflow

**Local Phase (Developer):**

1. Run `node ./scripts/release.ts --dist-tag latest --no-local` (optionally add `--version X.Y.Z` to override conventional commits)
2. Script calculates next version using conventional commits (or uses explicit `--version` if provided)
3. Interactive prompt displays version and changelog
4. Developer approves or declines
5. If approved: Git tag and GitHub Release are created (no npm publish)
6. If declined: Exit gracefully, no changes made

**CI Phase (Automation):**

1. GitHub Release publication triggers workflow (`on.release.types: [published]`)
2. Workflow waits for GitHub environment approval (required reviewer)
3. Script validates:
   - `GITHUB_ACTOR` is in allowlist
   - Registry is not localhost
   - Version is exact semver (e.g., `1.2.3`)
4. Publishes packages to npm
5. No versioning or tagging occurs (already done locally)

### 8.5.3 Version Management

- **No version commits:** Package versions in `package.json` remain as placeholders in source control
- **Git tags as source of truth:** Releases are identified by git tags (format: `{version}`)
- **Conventional commits:** Automatic version calculation based on commit messages
- **Nx release:** Leverages Nx release tooling for versioning, changelog, and publishing

### 8.5.4 Security and Authorization

- **Allowlist:** Hardcoded list of GitHub usernames authorized to publish to `@latest`
- **Environment protection:** GitHub Environment (`npm`) can enforce required reviewer approval when configured in repository settings
- **Trusted publishing:** Uses OIDC token authentication for npm publishing

### 8.5.5 Key Configuration

- `nx.json`: Release configuration with `git.tag: true`, `changelog.createRelease: 'github'`, and `git.commit: false`
- `scripts/release.ts`: Release automation script with CI detection and interactive prompts
- `.github/workflows/release.yaml`: CI workflows for canary and latest releases

### 8.5.6 Related Documentation

- [ADR-0005: Tags over Source Version Bumps](adr/0005-tags-over-source-version-bumps.md)
