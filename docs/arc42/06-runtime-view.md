# 6. Runtime View

This chapter describes Thymian's key runtime scenarios. All three validation workflows (lint, test, analyze) follow a shared lifecycle and differ mainly in the data inputs and the plugins that respond to the core workflow action.

## 6.1 Plugin Lifecycle

Every Thymian run follows the same lifecycle, regardless of the specific workflow:

```mermaid
sequenceDiagram
  participant CLI as CLI / Consumer
  participant T as Thymian
  participant E as ThymianEmitter
  participant CP as CorePlugin
  participant P as Plugins

  CLI->>T: register(plugin, options)
  Note over T: Store plugin reference

  CLI->>T: run(fn)
  activate T

  T->>T: ready()
  T->>E: registerPlugin(corePlugin)
  E->>CP: plugin(emitter, logger, opts)
  Note over CP: Subscribe to action/event handlers

  loop For each registered plugin
    T->>E: emit("core.register", { name, events, options })
    T->>P: plugin(emitter.child(name), logger, opts)
    Note over P: Subscribe to action/event handlers
  end

  T->>E: emitAction("core.ready")
  E-->>CP: core.ready
  E-->>P: core.ready
  Note over T: Lifecycle ready — workflow begins

  CLI->>T: fn(emitter, logger)
  Note over T: Execute workflow (lint/test/analyze)

  T->>E: emitAction("core.close")
  E-->>CP: core.close
  E-->>P: core.close
  Note over P: Clean up resources

  T->>E: shutdown(idleTimeout)
  E->>E: completeSubjects()

  deactivate T
  T-->>CLI: Result
```

## 6.2 Lint Workflow

The lint workflow performs **static analysis** of an API specification without sending HTTP requests. Core loads the specification and rules in parallel, then delegates static linting to the HTTP Linter plugin via the `core.lint` action.

```mermaid
sequenceDiagram
  participant CLI as CLI
  participant T as Thymian
  participant E as ThymianEmitter
  participant OA as OpenAPI Loader
  participant HL as HTTP Linter
  participant R as Reporter

  CLI->>T: lint({ specification, rules })
  activate T

  par Load format and rules
    T->>E: emitAction("core.format.load", { inputs }) [collect]
    E->>OA: core.format.load
    OA->>OA: Parse OpenAPI → ThymianFormat
    OA-->>E: reply(serializedFormat)
    E-->>T: formats[]
    T->>T: Merge formats into single ThymianFormat
  and
    T->>T: loadRules(rules, ruleFilter, rulesConfig)
  end

  T->>E: emitAction("core.lint", { format, rules, rulesConfig }) [collect]
  E->>HL: core.lint
  activate HL

  HL->>HL: Import ThymianFormat
  HL->>HL: Create RuleRunnerAdapter (mode: static)
  HL->>HL: runRules(rules, format, adapter)
  Note over HL: Iterate rules, each creates<br>LintContext against the format graph

  HL-->>E: reply({ source, status, violations, statistics })
  deactivate HL

  E-->>T: results[]

  T->>T: bridgeReports(results, format)
  T->>E: emit("core.report", report)
  E->>R: core.report
  R->>R: Buffer report sections

  T->>E: emitAction("core.report.flush") [collect]
  E->>R: core.report.flush
  R-->>E: reply({ text })

  T-->>CLI: WorkflowOutcome { classification, text, results }
  deactivate T
```

**Key characteristics:**

- No HTTP requests are sent — analysis is purely static against the ThymianFormat graph.
- `loadFormat` uses `emitFormat: false` — the format is not broadcast to other plugins.
- The `RuleRunnerAdapter` selects each rule's `lintRule` function and creates a `LintContext` (extending `ApiContext`).

## 6.3 Test Workflow

The test workflow performs **live HTTP testing** by generating sample requests from the specification, dispatching them to a target server, and validating the responses against rules.

```mermaid
sequenceDiagram
  participant CLI as CLI
  participant T as Thymian
  participant E as ThymianEmitter
  participant OA as OpenAPI Loader
  participant S as Sampler
  participant HT as HTTP Tester
  participant RD as Request Dispatcher
  participant R as Reporter

  CLI->>T: test({ specification, rules, targetUrl })
  activate T

  par Load format and rules
    T->>E: emitAction("core.format.load", { inputs }) [collect]
    E->>OA: core.format.load
    OA-->>E: reply(serializedFormat)
    E-->>T: formats[]
    T->>T: Merge formats into single ThymianFormat

    T->>E: emitAction("core.format", exportedFormat) [deep-merge]
    Note over E: Broadcast format to all plugins
    E->>S: core.format
    S->>S: Initialize samples + hook runner
    S-->>E: reply()
  and
    T->>T: loadRules(rules, ruleFilter, rulesConfig)
  end

  T->>E: emitAction("core.test", { format, rules, rulesConfig, targetUrl }) [collect]
  E->>HT: core.test
  activate HT

  HT->>HT: Import ThymianFormat, create TestContext
  HT->>HT: Create RuleRunnerAdapter (mode: test)
  HT->>HT: runRules(rules, format, adapter)

  Note over HT: For each transaction being tested:
  HT->>E: emitAction("core.request.sample", { transaction }) [first]
  E->>S: core.request.sample
  S-->>E: reply(httpRequestTemplate)
  E-->>HT: httpRequestTemplate

  HT->>E: emitAction("core.request.dispatch", { request }) [first]
  E->>RD: core.request.dispatch
  RD->>RD: HTTP request to target server
  RD-->>E: reply(httpResponse)
  E-->>HT: httpResponse

  HT->>HT: Validate response against rules

  HT-->>E: reply({ source, status, violations, statistics })
  deactivate HT

  E-->>T: results[]

  T->>T: bridgeReports(results, format)
  T->>E: emit("core.report", report)
  E->>R: core.report

  T->>E: emitAction("core.report.flush") [collect]
  E->>R: core.report.flush
  R-->>E: reply({ text })

  T-->>CLI: WorkflowOutcome { classification, text, results }
  deactivate T
```

**Key characteristics:**

- `loadFormat` uses `emitFormat: true` (default) — triggers `core.format` so the Sampler can initialize samples and hook runner.
- The HTTP Tester requests sample data via `core.request.sample` and dispatches HTTP requests via `core.request.dispatch`. Both are **core-owned infrastructure actions** (see [ADR-0010](adr/0010-core-owned-infrastructure-actions.md)).
- The Sampler optionally runs user-defined hooks (`http-testing.beforeRequest`, `http-testing.afterResponse`, `http-testing.authorize`) before/after each request.
- The `RuleRunnerAdapter` selects each rule's `testRule` function and creates a `TestContext`.

## 6.4 Analyze Workflow

The analyze workflow performs **post-hoc validation** of captured HTTP traffic against rules and (optionally) an API specification. Traffic is loaded from external sources (e.g., HAR files), inserted into a SQLite database, and validated by the HTTP Analyzer plugin.

```mermaid
sequenceDiagram
  participant CLI as CLI
  participant T as Thymian
  participant E as ThymianEmitter
  participant OA as OpenAPI Loader
  participant HA as HTTP Analyzer
  participant R as Reporter

  CLI->>T: analyze({ specification?, traffic, rules })
  activate T

  par Load traffic, rules, and optional format
    T->>E: emitAction("core.traffic.load", { inputs }) [collect]
    E-->>T: loadedTraffic[]
    T->>T: Merge transactions + traces
  and
    T->>T: loadRules(rules, ruleFilter, rulesConfig)
  and
    opt specification provided
      T->>E: emitAction("core.format.load", { inputs }) [collect]
      E->>OA: core.format.load
      OA-->>E: reply(serializedFormat)
      E-->>T: formats[]
      T->>T: Merge formats (emitFormat: false)
    end
  end

  T->>E: emitAction("core.analyze", { traffic, format?, rules, rulesConfig }) [collect]
  E->>HA: core.analyze
  activate HA

  HA->>HA: Import ThymianFormat (or create empty)
  HA->>HA: Create in-memory SQLite repository
  HA->>HA: Insert traces and transactions
  HA->>HA: Create RuleRunnerAdapter (mode: analytics)
  HA->>HA: runRules(rules, format, adapter)
  Note over HA: Each rule's analyzeRule is invoked<br>with an AnalyzeContext that queries<br>the SQLite repository

  HA->>HA: Close SQLite repository

  HA-->>E: reply({ source, status, violations, statistics })
  deactivate HA

  E-->>T: results[]

  T->>T: bridgeReports(results, format)
  T->>E: emit("core.report", report)
  E->>R: core.report

  T->>E: emitAction("core.report.flush") [collect]
  E->>R: core.report.flush
  R-->>E: reply({ text })

  T-->>CLI: WorkflowOutcome { classification, text, results }
  deactivate T
```

**Key characteristics:**

- The specification is **optional** — the analyze workflow can run with traffic data alone.
- `loadFormat` uses `emitFormat: false` — the format is not broadcast (the Sampler is not involved).
- The HTTP Analyzer creates an ephemeral in-memory SQLite database to store the loaded traffic, enabling SQL-based querying from within `AnalyzeContext`.
- The `RuleRunnerAdapter` selects each rule's `analyzeRule` function and creates an `AnalyzeContext`.
- No HTTP requests are sent — analysis is performed against captured traffic.

## 6.5 Shared Patterns Across Workflows

All three workflows share these patterns:

1. **Parallel loading:** Format/traffic and rules are loaded in parallel using `Promise.all`.
2. **Core-owned orchestration:** The `Thymian` class orchestrates the workflow, while plugins implement the mode-specific execution. See [ADR-0007](adr/0007-core-owns-validation-entrypoints-plugins-own-execution.md).
3. **Action collection strategy:** Workflow actions use `{ strategy: 'collect' }` to gather responses from all listening plugins. Infrastructure actions use `{ strategy: 'first' }` since only one plugin provides the capability.
4. **Report bridging:** The `Thymian` class converts `ValidationResult` violations into structured `ThymianReport` events, which are consumed by the Reporter plugin.
5. **Classification:** Results are classified as `'clean-run'`, `'findings'`, or `'tool-error'` based on the presence and severity of violations.
