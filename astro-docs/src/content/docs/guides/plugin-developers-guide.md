---
title: How to develop a plugin?
description: A guide in my new Starlight docs site.
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
- **`version`** (string): The version of Thymian the plugin is compatible with
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
- **`options`**: Configuration options from `thymian.config.json`/`yaml`

## The ThymianEmitter: API Overview

The `ThymianEmitter` is the central interface for plugin communication:

### Event Methods

#### `on(eventName, handler)`

Registers an event handler for a specific event.

```typescript
emitter.on('core.error', async (payload) => {
  console.log('Error received:', payload);
});
```

#### `emit(eventName, payload)`

Sends an event to all registered listeners (fire-and-forget).

```typescript
emitter.emit('core.report', {
  type: 'info',
  message: 'Plugin started successfully',
});
```

#### `emitError(error, name?)`

Sends an error event.

```typescript
emitter.emitError(new Error('Something went wrong'), 'my-plugin');
```

### Action Methods

#### `onAction(actionName, handler)`

Registers an action handler that responds to action requests.

```typescript
emitter.onAction('core.run', async (payload, ctx) => {
  // Process the action
  ctx.reply({
    value: {
      pluginName: 'my-plugin',
      status: 'success',
    },
  });
});
```

#### `emitAction(actionName, payload?, options?)`

Sends an action and waits for responses from all registered handlers.

```typescript
const responses = await emitter.emitAction('core.load-format');
console.log('Received responses:', responses);
```

**Options:**

- `timeout`: Maximum wait time in milliseconds (default: 1000)
- `strategy`: How to collect responses:
  - `'collect'` (default): Array of all responses
  - `'first'`: Only the first response
  - `'deep-merge'`: All responses are deeply merged

### Additional Methods

#### `child(source)`

Creates a child emitter with its own source name for better logging.

```typescript
const childEmitter = emitter.child('my-plugin:submodule');
```

## Lifecycle Actions: The Plugin Lifecycle

Thymian defines four central lifecycle actions that control the system's flow:

### 1. `core.ready`

**Event Payload:** `void`  
**Response Payload:** `void`  
**Timing:** Triggered after all plugins have been loaded and before main processing begins.  
**Usage:** Initialization of resources, connections, etc.

### 2. `core.load-format`

**Event Payload:** `void`  
**Response Payload:** `SerializedThymianFormat` (graph data structure)  
**Timing:** Called to load data from plugins.  
**Usage:** Plugins that provide data (e.g., import plugins) should respond here.

### 3. `core.run`

**Event Payload:** `SerializedThymianFormat`  
**Response Payload:** `RunActionResponse`  
**Timing:** The main processing phase where plugins work on the loaded data.  
**Usage:** Analysis, transformation, export of data.

**Response Structure:**

```typescript
{
  pluginName: string,
  status: 'success' | 'failed' | 'error',
  message?: string
}
```

### 4. `core.close`

**Event Payload:** `void`  
**Response Payload:** `void`  
**Timing:** Called before the system shuts down.  
**Usage:** Cleanup of resources, closing connections, saving state.

## Core Events

In addition to actions, the following system events exist:

- **`core.error`**: Triggered on errors
- **`core.register`**: Triggered when a plugin is registered
- **`core.report`**: For general status messages
- **`core.exit`**: Triggered before system shutdown

## Tutorial: Complete Example Plugin

Here is a complete example plugin that implements **all** lifecycle hooks and demonstrates them:

```javascript
// hello-world-plugin.js
export default {
  name: 'hello-world-plugin',
  version: '0.0.1',

  // Declaration: Which actions does this plugin listen to?
  actions: {
    listensOn: ['core.ready', 'core.load-format', 'core.run', 'core.close'],
  },

  // Declaration: Which events does this plugin listen to?
  events: {
    listensOn: ['core.error', 'core.register', 'core.report'],
  },

  async plugin(emitter, logger, options) {
    logger.info('Plugin is being initialized with options:', options);

    // ============================================
    // LIFECYCLE ACTION 1: core.ready
    // ============================================
    emitter.onAction('core.ready', async (payload, ctx) => {
      console.log('[HelloWorld] 🚀 core.ready - System is ready, plugins are loaded');
      logger.info('Ready phase: Initialization begins');

      // Here, for example, database connections could be established
      // await connectToDatabase();

      ctx.reply();
    });

    // ============================================
    // LIFECYCLE ACTION 3: core.run
    // ============================================
    emitter.onAction('core.run', async (payload, ctx) => {
      logger.info('My plugin received payload.');

      // Logic for processing

      // Respond with status
      ctx.reply({
        value: {
          pluginName: 'hello-world-plugin',
          status: 'success',
          message: `Successfully processed ${payload.nodes.length} nodes and ${payload.edges.length} edges`,
        },
      });
    });

    // ============================================
    // LIFECYCLE ACTION 4: core.close
    // ============================================
    emitter.onAction('core.close', async (payload, ctx) => {
      logger.info('Close phase: Clean up and close connections');

      // Here resources would be released
      // await disconnectFromDatabase();
      // await saveState();

      ctx.reply();
    });

    // ============================================
    // EVENT LISTENER: core.error
    // ============================================
    emitter.on('core.error', async (error) => {
      logger.error('Error detected in system:', error);
      // Error handling, e.g., send notifications
    });

    // ============================================
    // EVENT LISTENER: core.register
    // ============================================
    emitter.on('core.register', async (event) => {
      logger.info('New plugin was registered:', event);
      // Track which plugins were loaded
    });

    // ============================================
    // EVENT LISTENER: core.report
    // ============================================
    emitter.on('core.report', async (report) => {
      logger.info('Report event:', report);
      // Collect statistics or reports
    });

    // ============================================
    // CUSTOM ACTION: Example for own action
    // ============================================
    // Plugins can also define and provide their own actions
    emitter.onAction('hello-world.greet', async (payload, ctx) => {
      const name = payload?.name || 'World';
      ctx.reply({
        value: {
          greeting: `Hello ${name}!`,
          timestamp: new Date().toISOString(),
        },
      });
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
thymian run --plugin ./path/to/my-plugin.js
```

### Via Configuration File

Plugins are registered in `thymian.config.json` or `thymian.config.yaml`:

**JSON Format:**

```json
{
  "plugins": {
    "my-awesome-plugin": {
      "module": "./path/to/my-plugin.js",
      "enabled": true,
      "greeting": "Hello World",
      "customOption": 42
    },
    "hello-world-plugin": {
      "module": "./plugins/hello-world-plugin.js",
      "enabled": true
    }
  }
}
```

**YAML Format:**

```yaml
plugins:
  my-awesome-plugin:
    path: ./path/to/my-plugin.js
    options:
      greeting: Hello World
      customOption: 42

  hello-world-plugin:
    path: ./path-to-plugin/hello-world-plugin.js
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

Use the provided logger instead of console.log:

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

### 4. Resource Management

Use `core.close` to properly release resources:

```javascript
emitter.onAction('core.close', async (payload, ctx) => {
  await closeDatabase();
  await saveState();
  ctx.reply({ value: undefined });
});
```

### 5. Child Emitters for Submodules

Use child emitters for better logging and organization:

```javascript
const subEmitter = emitter.child('my-plugin:submodule');
subEmitter.emit('core.report', { ... }); // Source is automatically set
```

## Summary

A complete Thymian plugin:

1. **Exports an object** with `name`, `version`, and `plugin` function
2. **Registers handlers** for lifecycle actions (ready, load-format, run, close)
3. **Implements event listeners** for system events (error, register, report)
4. **Communicates via the emitter** with other plugins
5. **Handles errors** in all handlers properly
6. **Uses logging** for diagnostics and monitoring
7. **Is registered in the config** (`thymian.config.json`/`.yaml`)

With this knowledge, you can develop powerful plugins that integrate seamlessly into the Thymian system!
