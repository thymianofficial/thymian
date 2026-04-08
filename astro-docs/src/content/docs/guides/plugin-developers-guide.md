---
title: How to develop a plugin?
description: Learn how to build plugins that extend Thymian through its event-driven architecture.
---

## Introduction

Thymian is an event- and action-based system that can be extended through plugins. The plugin system is based on a central **Event Emitter** through which plugins can communicate with each other.

### Core Concepts

- **Events**: Simple messages that can be sent by plugins (fire-and-forget)
- **Actions**: Request-response-based communication between plugins
- **Lifecycle Actions**: Special actions that control the system's lifecycle
- **Plugin Function**: The main entry point of a plugin, called at startup

## The Plugin Interface

A Thymian plugin is a JavaScript/TypeScript object that implements the `ThymianPlugin` interface:

```typescript
export type ThymianPlugin<Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>> = {
  plugin: ThymianPluginFn<Options & { cwd: string }>;
  options?: JSONSchemaType<Options>;
  name: string;
  version: string;
  events?: ThymianPluginEvents;
  actions?: ThymianPluginActions;
};
```

### Required Fields

- **`name`** (string): Unique name of the plugin
- **`version`** (string): The version of Thymian the plugin is compatible with (semver constraint)
- **`plugin`** (function): The main function executed at startup

### Optional Fields

- **`options`**: JSON schema for validating plugin configuration
- **`events`**: Declaration of which events the plugin provides, sends, or receives
- **`actions`**: Declaration of which actions the plugin provides, requires, or uses

### The Plugin Function

The plugin function receives three parameters:

```typescript
type ThymianPluginFn<Options> = (emitter: ThymianEmitter, logger: Logger, options: Options) => Promise<void>;
```

- **`emitter`**: The event emitter for communication
- **`logger`**: Logger instance for structured logging
- **`options`**: Configuration options from `thymian.config.yaml`, plus `cwd` (automatically added)

## The ThymianEmitter: API Overview

The `ThymianEmitter` is the central interface for plugin communication:

### Event Methods

#### `on(eventName, handler)`

Registers an event handler for a specific event.

```typescript
emitter.on('core.error', async (error) => {
  logger.error('Error received:', error.message);
});
```

#### `emit(eventName, payload)`

Sends an event to all registered listeners (fire-and-forget).

```typescript
emitter.emit('core.report', {
  source: 'my-plugin',
  message: 'Analysis complete',
  sections: [
    {
      heading: 'GET /pets -> 200 OK',
      items: [
        {
          severity: 'warn',
          message: 'Missing Cache-Control header',
          ruleName: 'my-plugin/cache-control',
        },
      ],
    },
  ],
});
```

#### `emitError(error, name?)`

Sends an error event.

```typescript
emitter.emitError(new Error('Something went wrong'), 'my-plugin');
```

### Action Methods

#### `onAction(actionName, handler)`

Registers an action handler that responds to action requests. The handler receives the action payload and a context object with `reply()` and `error()` methods.

```typescript
emitter.onAction('core.format.load', async (payload, ctx) => {
  // Load and parse a specification format
  const format = await loadMyFormat(payload.inputs);

  ctx.reply({
    value: format,
  });
});
```

#### `emitAction(actionName, payload?, options?)`

Sends an action and waits for responses from registered handlers.

```typescript
const responses = await emitter.emitAction('core.format.load', {
  inputs: [{ type: 'openapi', location: './openapi.yaml' }],
});
```

**Options:**

- `timeout`: Maximum wait time in milliseconds (default: 1000)
- `strategy`: How to collect responses:
  - `'collect'` (default): Array of all responses
  - `'first'`: Only the first response
  - `'deep-merge'`: All responses are deeply merged
- `strict`: Whether to emit an error if no handler is registered for a non-core action (default: `true`)

### Error Methods

#### `onError(handler)`

Registers a handler for error events.

```typescript
emitter.onError((errorEvent) => {
  logger.error('Error from', errorEvent.source, ':', errorEvent.message);
});
```

### Additional Methods

#### `child(source)`

Creates a child emitter with its own source name for better traceability. Child emitters share the same underlying event bus.

```typescript
const childEmitter = emitter.child('my-plugin:submodule');
```

## Lifecycle Actions

Thymian defines two lifecycle actions that control the system's flow:

### `core.ready`

**Payload:** `void`
**Response:** `void`
**Timing:** Triggered after all plugins have been loaded and their plugin functions have been called.
**Usage:** Post-initialization tasks that require all plugins to be registered (e.g., establishing connections, checking for required sibling plugins).

### `core.close`

**Payload:** `void`
**Response:** `void`
**Timing:** Called before the system shuts down.
**Usage:** Cleanup of resources, closing connections, saving state.

### Lifecycle Sequence

```text
thymian.run(fn)
  |
  +-> ready()
  |     +-> For each plugin:
  |     |     emit('core.register', { name, events, options })
  |     |     plugin.plugin(childEmitter, childLogger, options)
  |     |
  |     +-> emitAction('core.ready')
  |
  +-> fn(emitter, logger)          // user workflow (lint, test, analyze, ...)
  |
  +-> close()
        +-> emitAction('core.close')
        +-> emitter.shutdown()
```

## Core Events

Events are fire-and-forget messages. Plugins listen with `emitter.on(...)`.

| Event           | Payload                     | Description                                                                                                              |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core.error`    | `ThymianError`              | Emitted when an error occurs. Includes `name`, `message`, and optional `severity`, `exitCode`, `suggestions`, `code`.    |
| `core.register` | `{ name, options, events }` | Emitted once per plugin during the loading phase. Lets other plugins discover registered peers.                          |
| `core.report`   | `ThymianReport`             | Structured validation/analysis report. Contains `source`, `message`, and optional `sections` with severity-tagged items. |
| `core.exit`     | `{ code? }`                 | Signals process exit with an optional exit code.                                                                         |

## Core Actions

Actions are request-response interactions. Plugins listen with `emitter.onAction(...)` and must call `ctx.reply(...)` to respond.

### Specification and Traffic Loading

| Action              | Request Payload           | Response Payload                        | Strategy  | Description                                                                                                                      |
| ------------------- | ------------------------- | --------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `core.format.load`  | `{ inputs, options? }`    | `SerializedThymianFormat`               | `collect` | Load and parse API specification(s) into the internal format graph. Each plugin may return a partial graph; Thymian merges them. |
| `core.format`       | `SerializedThymianFormat` | `void`                                  | `collect` | Broadcasts the finalized, merged format graph to all interested plugins. Emitted after `core.format.load` completes.             |
| `core.traffic.load` | `{ inputs, options? }`    | `{ transactions?, traces?, metadata? }` | `collect` | Load captured HTTP traffic data. Plugins return matching transaction/trace data.                                                 |

### Validation Workflows

| Action         | Request Payload                                          | Response Payload   | Strategy  | Description                                                         |
| -------------- | -------------------------------------------------------- | ------------------ | --------- | ------------------------------------------------------------------- |
| `core.lint`    | `{ format, rules?, rulesConfig?, options? }`             | `ValidationResult` | `collect` | Run lint rules against a format (static analysis, no live traffic). |
| `core.test`    | `{ format, targetUrl?, rules?, rulesConfig?, options? }` | `ValidationResult` | `collect` | Run test rules against a live target URL.                           |
| `core.analyze` | `{ traffic, format?, rules?, rulesConfig?, options? }`   | `ValidationResult` | `collect` | Run analysis rules against captured traffic.                        |

`ValidationResult` contains `source`, `status` (`'success'` | `'failed'` | `'error'`), `violations[]`, and optional `statistics`.

### Reporting

| Action              | Request Payload | Response Payload | Strategy  | Description                                                                         |
| ------------------- | --------------- | ---------------- | --------- | ----------------------------------------------------------------------------------- |
| `core.report.flush` | `void`          | `{ text? }`      | `collect` | Tells reporter plugins to finalize their output. Returns the formatted report text. |

### HTTP Request Handling

| Action                  | Request Payload             | Response Payload      | Strategy | Description                                                                                 |
| ----------------------- | --------------------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `core.request.sample`   | `{ transaction, options? }` | `HttpRequestTemplate` | `first`  | Generate a sample HTTP request from a format transaction. Only one plugin needs to respond. |
| `core.request.dispatch` | `{ request, options? }`     | `HttpResponse`        | `first`  | Send an HTTP request and return the response. Only one plugin needs to respond.             |

:::note
Actions using `first` strategy return only the first response, while `collect` waits for all registered handlers.
:::

## Tutorial: Complete Example Plugin

Here is a complete example plugin that listens to lifecycle actions, core events, and the `core.format` broadcast:

```javascript
// my-format-inspector-plugin.js
export default {
  name: 'my-format-inspector',
  version: '0.0.1',

  // Declaration: Which actions does this plugin listen to?
  actions: {
    listensOn: ['core.ready', 'core.format', 'core.close'],
  },

  // Declaration: Which events does this plugin listen to?
  events: {
    listensOn: ['core.error', 'core.register', 'core.report'],
  },

  async plugin(emitter, logger, options) {
    logger.info('Plugin is being initialized with options:', options);

    // ============================================
    // LIFECYCLE ACTION: core.ready
    // ============================================
    emitter.onAction('core.ready', async (payload, ctx) => {
      logger.info('System is ready, all plugins are loaded');
      ctx.reply();
    });

    // ============================================
    // ACTION: core.format
    // Receives the merged API specification format
    // ============================================
    emitter.onAction('core.format', async (format, ctx) => {
      logger.info('Received format with', format.nodes.length, 'nodes');

      // Inspect the format graph, e.g., collect endpoints
      // You could emit reports based on the format analysis

      ctx.reply();
    });

    // ============================================
    // LIFECYCLE ACTION: core.close
    // ============================================
    emitter.onAction('core.close', async (payload, ctx) => {
      logger.info('Cleaning up resources');
      ctx.reply();
    });

    // ============================================
    // EVENT LISTENER: core.error
    // ============================================
    emitter.on('core.error', async (error) => {
      logger.error('Error detected:', error.message);
    });

    // ============================================
    // EVENT LISTENER: core.register
    // ============================================
    emitter.on('core.register', async (event) => {
      logger.info('Plugin registered:', event.name);
    });

    // ============================================
    // EVENT LISTENER: core.report
    // ============================================
    emitter.on('core.report', async (report) => {
      logger.info('Report from', report.source, ':', report.message);
    });

    logger.info('Plugin initialization completed - all handlers registered');
  },
};
```

## Plugin Integration: Registration and Configuration

### 1. Create Plugin File

Create a JavaScript or TypeScript file for your plugin:

```javascript
// my-plugin.js or my-plugin.ts
export default {
  name: 'my-awesome-plugin',
  version: '1.0.0',
  async plugin(emitter, logger, options) {
    // Plugin logic
  },
};
```

### 2. Plugin Registration

You can register plugins via the Thymian configuration file or via CLI.

### Via CLI

If you want to load a plugin directly via the CLI, use the `--plugin` option:

```bash
thymian lint --plugin ./path/to/my-plugin.js
```

### Via Configuration File

Plugins are registered in `thymian.config.yaml`:

```yaml
plugins:
  my-awesome-plugin:
    path: ./path/to/my-plugin.js
    options:
      greeting: Hello World
      customOption: 42

  my-format-inspector:
    path: ./plugins/my-format-inspector-plugin.js
```

### 3. Plugin Options

All options from the configuration are passed as the `options` parameter to the plugin function:

```javascript
async plugin(emitter, logger, options) {
  console.log(options.greeting); // "Hello World"
  console.log(options.customOption); // 42
  console.log(options.cwd); // Working directory (automatically added)
}
```

## Best Practices

### 1. Logging

Use the provided logger instead of `console.log`:

```javascript
logger.info('Informative message', { additionalData: 'value' });
logger.warn('Warning');
logger.error('Error', error);
logger.debug('Debug info');
```

### 2. Asynchronous Operations

The plugin function and all handlers should be async:

```javascript
async plugin(emitter, logger, options) {
  // Use await for asynchronous operations
  await someAsyncOperation();
}
```

### 3. Resource Management

Use `core.close` to properly release resources:

```javascript
emitter.onAction('core.close', async (payload, ctx) => {
  await closeDatabase();
  await saveState();
  ctx.reply();
});
```

### 4. Child Emitters for Submodules

Use child emitters for better logging and organization:

```javascript
const subEmitter = emitter.child('my-plugin:submodule');
subEmitter.emit('core.report', {
  source: 'my-plugin:submodule',
  message: 'Sub-analysis complete',
});
```

### 5. Declare Your Event and Action Dependencies

Always declare which events and actions your plugin interacts with. This helps Thymian validate the plugin graph and lets other plugins discover capabilities:

```javascript
export default {
  name: 'my-plugin',
  version: '1.0.0',

  events: {
    listensOn: ['core.error', 'core.report'],
    emits: ['core.report'],
  },

  actions: {
    listensOn: ['core.ready', 'core.lint', 'core.close'],
    requires: ['core.format.load'],
  },

  async plugin(emitter, logger, options) {
    // ...
  },
};
```

## Summary

A complete Thymian plugin:

1. **Exports an object** with `name`, `version`, and `plugin` function
2. **Registers handlers** for lifecycle actions (`core.ready`, `core.close`)
3. **Listens to workflow actions** as needed (`core.format.load`, `core.format`, `core.lint`, `core.test`, `core.analyze`, etc.)
4. **Implements event listeners** for system events (`core.error`, `core.register`, `core.report`, `core.exit`)
5. **Communicates via the emitter** with other plugins
6. **Declares its dependencies** via `events` and `actions` metadata
7. **Uses logging** for diagnostics and monitoring
8. **Is registered in the config** (`thymian.config.yaml`)

With this knowledge, you can develop powerful plugins that integrate seamlessly into the Thymian system!
