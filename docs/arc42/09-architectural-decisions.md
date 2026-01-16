# 9. Architectural Decisions

## Core features are plugins and are treated as such

| Date       | Status   |
| ---------- | -------- |
| 2024-11-07 | Accepted |

### Context

### Decision

To improve modularity, even pre-built features like the file loader and the OpenAPI parsers will be implemented as plugins.

Plugins have their schema files packages. (similarly to nx generator/executor schema files)

The configuration of the plugins happens in the Thymian config.

### Consequences

The code will be easier to maintain because there are no hard-coded implementations. It's harder to implement the initial version because the plugin system needs to be set up as well.

## Communication as a plugin

| Date       | Status   |
| ---------- | -------- |
| 2024-11-07 | Proposed |

### Context

The interoperability and DX quality goals lead to the question whether it should be possible to write plugins in other languages and as a result, how would the communication with the other languages happen.

The initial implementation allows only for importing JS files.

### Decision

It should be possible to write plugins in other languages so developers can use 'their' language. Simple import of JS files is therefore insufficient.

Communication with other plugins will itself be a wrapper plugin. That allows the use of either importing JS files (default) or other ways like TCP or Shell (stdin/stdout) plugins.

It's not implemented immediately, but the implementation should allow for extending the communication as plugin.

Important: exchanged information must be serializable.

### Consequences

The whole system is more flexible but harder to understand.

## Plugins should allow for streaming

| Date       | Status   |
| ---------- | -------- |
| 2024-11-07 | Proposed |

### Context

Wait time for results might be long depending on API size and number of checked rules. It would improve DX if results could be seen as soon as possible, which is as rules are evaluated on API statements.

### Decision

### Consequences

## Plugins should run isolated

| Date       | Status   |
| ---------- | -------- |
| 2024-11-07 | Proposed |

### Context

Simply importing plugins in the form of JS files allows for injection attacks. Should Thymian use a container or sandbox system like V8 Isolates to run plugins safely?

### Decision

### Consequences
